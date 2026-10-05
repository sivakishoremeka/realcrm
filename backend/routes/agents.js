const express = require('express');
const AgentProfile = require('../models/AgentProfile');
const Property = require('../models/Property');
const ServiceZone = require('../models/ServiceZone');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { requireRole, normalizeRole } = require('../middleware/roles');
const { encryptToken } = require('../services/tokenCrypto');
const { signStoredImageUrl, withSignedImagesMany } = require('../services/s3');

const router = express.Router();

router.use(auth);

async function getOrCreateProfile(userId, { withSecrets = false } = {}) {
  let query = AgentProfile.findOne({ user: userId });
  if (withSecrets) {
    query = query.select('+metaAccessTokenEnc +openaiApiKeyEnc');
  }
  let profile = await query;
  if (!profile) {
    profile = await AgentProfile.create({ user: userId });
    if (withSecrets) {
      profile = await AgentProfile.findOne({ user: userId }).select(
        '+metaAccessTokenEnc +openaiApiKeyEnc'
      );
    }
  }
  return profile;
}

async function publicProfilePayload(profile, user, role) {
  const obj = profile.toObject();
  delete obj.metaAccessTokenEnc;
  delete obj.openaiApiKeyEnc;
  const profilePic = user.profilePic
    ? await signStoredImageUrl(user.profilePic)
    : '';
  return {
    ...obj,
    instagramConnected: !!(profile.instagramUserId && profile.instagramConnectedAt),
    hasOpenaiKey: !!profile.openaiApiKeyEnc,
    openaiModel: profile.openaiModel || 'gpt-4o-mini',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role,
      profilePic,
    },
  };
}

router.get('/me', requireRole('agent', 'admin'), async (req, res) => {
  try {
    if (normalizeRole(req.user) === 'admin') {
      return res.json({
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: 'admin',
        },
        onboardingComplete: true,
        zones: [],
        hasOpenaiKey: false,
      });
    }

    const profile = await getOrCreateProfile(req.user._id, { withSecrets: true });
    await profile.populate('zones', 'name city slug lat lng');
    res.json(await publicProfilePayload(profile, req.user, normalizeRole(req.user)));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load profile' });
  }
});

router.put('/me', requireRole('agent'), async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user._id);
    const { phone, agencyName, bio, yearsExperience, zoneIds, complete } = req.body;

    if (phone !== undefined) profile.phone = phone;
    if (agencyName !== undefined) profile.agencyName = agencyName;
    if (bio !== undefined) profile.bio = bio;
    if (yearsExperience !== undefined) {
      profile.yearsExperience = Number(yearsExperience) || 0;
    }

    if (Array.isArray(zoneIds)) {
      const zones = await ServiceZone.find({ _id: { $in: zoneIds } });
      profile.zones = zones.map((z) => z._id);
    }

    if (complete === true) {
      if (!profile.phone?.trim()) {
        return res.status(400).json({ message: 'Phone is required to complete onboarding' });
      }
      if (!profile.zones?.length) {
        return res.status(400).json({ message: 'Select at least one service zone' });
      }
      profile.onboardingComplete = true;
    }

    await profile.save();
    const fresh = await getOrCreateProfile(req.user._id, { withSecrets: true });
    await fresh.populate('zones', 'name city slug lat lng');
    res.json(await publicProfilePayload(fresh, req.user, 'agent'));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update profile' });
  }
});

router.put('/me/openai-key', requireRole('agent'), async (req, res) => {
  try {
    const { apiKey, model } = req.body;
    const profile = await getOrCreateProfile(req.user._id, { withSecrets: true });

    if (apiKey === '' || apiKey === null) {
      profile.openaiApiKeyEnc = '';
    } else if (typeof apiKey === 'string' && apiKey.trim()) {
      const key = apiKey.trim();
      if (!key.startsWith('sk-')) {
        return res.status(400).json({
          message: 'OpenAI API keys usually start with sk-. Paste your key from platform.openai.com',
        });
      }
      profile.openaiApiKeyEnc = encryptToken(key);
    } else {
      return res.status(400).json({ message: 'apiKey is required (or empty string to clear)' });
    }

    if (model !== undefined && String(model).trim()) {
      profile.openaiModel = String(model).trim();
    }

    await profile.save();
    res.json({
      hasOpenaiKey: !!profile.openaiApiKeyEnc,
      openaiModel: profile.openaiModel || 'gpt-4o-mini',
      message: profile.openaiApiKeyEnc
        ? 'OpenAI key saved. Caption generation will use your credits.'
        : 'OpenAI key removed.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to save OpenAI key' });
  }
});

router.get('/me/zones', requireRole('agent'), async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user._id);
    await profile.populate('zones', 'name city slug lat lng');
    res.json(profile.zones || []);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load zones' });
  }
});

router.put('/me/zones', requireRole('agent'), async (req, res) => {
  try {
    const { zoneIds } = req.body;
    if (!Array.isArray(zoneIds)) {
      return res.status(400).json({ message: 'zoneIds array is required' });
    }
    const zones = await ServiceZone.find({ _id: { $in: zoneIds } });
    const profile = await getOrCreateProfile(req.user._id);
    profile.zones = zones.map((z) => z._id);
    await profile.save();
    await profile.populate('zones', 'name city slug lat lng');
    res.json(profile.zones);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update zones' });
  }
});

router.get('/', requireRole('admin'), async (_req, res) => {
  try {
    const profiles = await AgentProfile.find()
      .populate('user', 'name email role profilePic')
      .populate('zones', 'name city slug lat lng')
      .sort({ updatedAt: -1 });

    const withCounts = await Promise.all(
      profiles
        .filter(
          (p) =>
            p.user &&
            ['publisher', 'agent', 'owner', 'sales'].includes(p.user.role)
        )
        .map(async (p) => {
          const inventoryCount = await Property.countDocuments({ agent: p.user._id });
          const availableCount = await Property.countDocuments({
            agent: p.user._id,
            status: 'Available',
          });
          const obj = p.toObject();
          if (obj.user?.profilePic) {
            obj.user.profilePic = await signStoredImageUrl(obj.user.profilePic);
          }
          return {
            ...obj,
            inventoryCount,
            availableCount,
          };
        })
    );

    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to list agents' });
  }
});

router.get('/:id', requireRole('admin'), async (req, res) => {
  try {
    const profile = await AgentProfile.findOne({ user: req.params.id })
      .populate('user', 'name email role profilePic')
      .populate('zones', 'name city slug lat lng');
    if (!profile) {
      const user = await User.findById(req.params.id).select(
        'name email role profilePic'
      );
      if (!user) return res.status(404).json({ message: 'Agent not found' });
      const u = user.toObject();
      if (u.profilePic) u.profilePic = await signStoredImageUrl(u.profilePic);
      return res.json({
        user: u,
        onboardingComplete: false,
        zones: [],
        inventoryCount: 0,
        ratingAvg: 0,
        ratingCount: 0,
        reviews: [],
      });
    }
    const inventoryCount = await Property.countDocuments({ agent: profile.user._id });
    const properties = await Property.find({ agent: profile.user._id })
      .populate('zone', 'name city')
      .sort({ createdAt: -1 })
      .limit(50);
    const AgentReview = require('../models/AgentReview');
    const reviews = await AgentReview.find({ agent: profile.user._id })
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);
    const obj = profile.toObject();
    if (obj.user?.profilePic) {
      obj.user.profilePic = await signStoredImageUrl(obj.user.profilePic);
    }
    res.json({
      ...obj,
      inventoryCount,
      properties: await withSignedImagesMany(properties),
      reviews,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load agent' });
  }
});

module.exports = router;
