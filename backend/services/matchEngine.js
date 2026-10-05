const AgentProfile = require('../models/AgentProfile');
const Property = require('../models/Property');
const { signStoredImageUrl } = require('./s3');

function zoneIdsEqual(a, b) {
  return String(a) === String(b);
}

function zoneInList(zoneId, list = []) {
  return list.some((z) => zoneIdsEqual(z, zoneId));
}

/**
 * Score agents against a buyer requirement.
 * +40 zone, +30 inventory, +20 BHK, +10 budget, +up to 15 rating. Cap 100.
 */
async function matchAgentsForRequirement(requirement, { limit = 20 } = {}) {
  const preferredZones = (requirement.preferredZones || []).map((z) =>
    typeof z === 'object' && z._id ? z._id : z
  );

  const profiles = await AgentProfile.find({ onboardingComplete: true })
    .populate('user', 'name email role profilePic')
    .populate('zones', 'name city slug');

  const agentIds = profiles.map((p) => p.user?._id).filter(Boolean);
  const properties = await Property.find({
    agent: { $in: agentIds },
    status: 'Available',
  }).populate('zone', 'name');

  const propsByAgent = new Map();
  properties.forEach((p) => {
    const key = String(p.agent);
    if (!propsByAgent.has(key)) propsByAgent.set(key, []);
    propsByAgent.get(key).push(p);
  });

  const results = [];

  for (const profile of profiles) {
    if (!profile.user) continue;
    const role =
      profile.user.role === 'sales' ||
      profile.user.role === 'agent' ||
      profile.user.role === 'owner'
        ? 'publisher'
        : profile.user.role;
    if (role !== 'publisher') continue;

    const agentZoneIds = (profile.zones || []).map((z) => z._id || z);
    const inventory = propsByAgent.get(String(profile.user._id)) || [];
    const reasons = [];
    let score = 0;

    const servesPreferred = preferredZones.length
      ? preferredZones.some((pz) => zoneInList(pz, agentZoneIds))
      : agentZoneIds.length > 0;

    if (preferredZones.length && servesPreferred) {
      score += 40;
      reasons.push('Serves preferred zone(s)');
    } else if (!preferredZones.length && agentZoneIds.length) {
      score += 20;
      reasons.push('Has service zones listed');
    }

    const typeMatch = (prop) =>
      !requirement.propertyType ||
      requirement.propertyType === 'Any' ||
      prop.type === requirement.propertyType;

    const listingMatch = (prop) => prop.listingType === requirement.listingType;

    const inPreferredZone = (prop) => {
      if (!preferredZones.length) return true;
      const zid = prop.zone?._id || prop.zone;
      return zoneInList(zid, preferredZones);
    };

    const typedInventory = inventory.filter(
      (p) => typeMatch(p) && listingMatch(p) && inPreferredZone(p)
    );

    if (typedInventory.length) {
      score += 30;
      reasons.push('Matching inventory in preferred zones');
    }

    const bhkMin = requirement.bhkMin;
    const bhkMax = requirement.bhkMax;
    const bhkFit = typedInventory.some((p) => {
      if (p.bhk == null) {
        return requirement.propertyType === 'Plot' || requirement.propertyType === 'Commercial';
      }
      if (bhkMin != null && p.bhk < bhkMin) return false;
      if (bhkMax != null && p.bhk > bhkMax) return false;
      return true;
    });
    if (bhkFit && (bhkMin != null || bhkMax != null)) {
      score += 20;
      reasons.push('BHK fits requirement');
    }

    const budgetMin = requirement.budgetMin ?? 0;
    const budgetMax = requirement.budgetMax;
    const priceFit = typedInventory.some((p) => {
      if (budgetMax != null && p.price > budgetMax) return false;
      if (p.price < budgetMin) return false;
      return true;
    });
    if (priceFit && (budgetMin > 0 || budgetMax != null)) {
      score += 10;
      reasons.push('Price within budget');
    }

    const ratingAvg = profile.ratingAvg || 0;
    const ratingCount = profile.ratingCount || 0;
    if (ratingCount >= 1 && ratingAvg > 0) {
      const ratingBoost = Math.round((ratingAvg / 5) * 15);
      score += ratingBoost;
      reasons.push(`Community rating ${ratingAvg.toFixed(1)} (${ratingCount})`);
    }

    score = Math.min(100, score);
    if (score <= 0) continue;

    const profilePic = profile.user.profilePic
      ? await signStoredImageUrl(profile.user.profilePic)
      : '';

    results.push({
      agent: {
        id: profile.user._id,
        name: profile.user.name,
        email: profile.user.email,
        phone: profile.phone,
        agencyName: profile.agencyName,
        yearsExperience: profile.yearsExperience,
        profilePic,
        ratingAvg,
        ratingCount,
        zones: profile.zones,
      },
      score,
      reasons,
      matchingPropertyCount: typedInventory.length,
      inventoryCount: inventory.length,
    });
  }

  results.sort(
    (a, b) =>
      b.score - a.score ||
      (b.agent.ratingAvg || 0) - (a.agent.ratingAvg || 0) ||
      b.matchingPropertyCount - a.matchingPropertyCount
  );
  return results.slice(0, limit);
}

module.exports = { matchAgentsForRequirement };
