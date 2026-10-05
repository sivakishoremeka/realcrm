/** Query value → list of strings. Accepts "a,b", repeated params, or nothing. */
function toList(value) {
  if (value == null) return [];
  return []
    .concat(value)
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Facet getter result (value, {value,label}, or a list of either) → [{value,label}]. */
function toEntries(raw) {
  return []
    .concat(raw ?? [])
    .map((v) => (v && typeof v === 'object' && 'value' in v ? v : { value: v }))
    .filter((e) => e.value != null && e.value !== '')
    .map((e) => ({ value: String(e.value), label: String(e.label || e.value) }));
}

/**
 * Build a search function that filters items and counts facet values.
 * Each facet's counts ignore that facet's own selection (so the other options
 * stay visible with the number of items you'd get by switching to them).
 *
 * @param {object} config
 * @param {Record<string, (item: object) => any>} config.facets key → value(s) of an item
 * @param {(item: object) => any[]} config.text strings the `q` param searches
 * @param {(item: object, query: object) => boolean} [config.where] extra non-facet filter
 * @returns {(items: object[], query?: object) => { items: object[], facets: Record<string, {value: string, label: string, count: number}[]>, total: number }}
 */
// ponytail: filters in memory over one user's records; move to a Mongo $facet
// aggregation + pagination if a single user gets into the thousands.
function createFacetSearch({ facets, text, where }) {
  const keys = Object.keys(facets);

  return function search(items, query = {}) {
    const q = String(query.q || '').trim().toLowerCase();
    const selected = Object.fromEntries(keys.map((key) => [key, toList(query[key])]));

    const base = items
      .filter((item) => {
        if (where && !where(item, query)) return false;
        if (!q) return true;
        return text(item).some((t) => String(t || '').toLowerCase().includes(q));
      })
      .map((item) => ({
        item,
        entries: Object.fromEntries(keys.map((key) => [key, toEntries(facets[key](item))])),
      }));

    const passes = (row, skipKey) =>
      keys.every(
        (key) =>
          key === skipKey ||
          !selected[key].length ||
          row.entries[key].some((e) => selected[key].includes(e.value))
      );

    const counted = Object.fromEntries(
      keys.map((key) => {
        const counts = new Map();
        base.forEach((row) => {
          if (!passes(row, key)) return;
          row.entries[key].forEach(({ value, label }) => {
            counts.set(value, { value, label, count: (counts.get(value)?.count || 0) + 1 });
          });
        });
        const values = [...counts.values()].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true })
        );
        return [key, values];
      })
    );

    return {
      items: base.filter((row) => passes(row)).map((row) => row.item),
      facets: counted,
      total: items.length,
    };
  };
}

const zoneEntry = (zone) => zone && { value: zone._id, label: zone.name };
const idOf = (ref) => String(ref?._id || ref || '');

/** My properties: q, minPrice, maxPrice + postAs, status, type, listingType, bhk, zone. */
const searchPosts = createFacetSearch({
  facets: {
    postAs: (p) => p.postAs,
    status: (p) => p.status,
    type: (p) => p.type,
    listingType: (p) => p.listingType,
    bhk: (p) => p.bhk,
    zone: (p) => zoneEntry(p.zone),
  },
  text: (p) => [p.title, p.address, p.notes, p.zone?.name],
  where: (p, query) => {
    const minPrice = toNumber(query.minPrice);
    const maxPrice = toNumber(query.maxPrice);
    if (minPrice != null && p.price < minPrice) return false;
    if (maxPrice != null && p.price > maxPrice) return false;
    return true;
  },
});

/**
 * Where a lead stands for this user: New (Open), Matched, Assigned, Closed, or
 * Sent — a lead the user generated that is now with another agent.
 */
function leadStage(lead, userId) {
  if (lead.status === 'Closed') return 'Closed';
  const assigned = idOf(lead.assignedAgent);
  const isMine = [idOf(lead.createdBy), idOf(lead.leadGenerator)].includes(String(userId));
  if (assigned && assigned !== String(userId) && isMine) return 'Sent';
  return lead.status === 'Open' ? 'New' : lead.status;
}

/** Leads: q + stage, read, listingType, propertyType, zone. Expects `stage` and `isRead` set. */
const searchLeads = createFacetSearch({
  facets: {
    stage: (l) => l.stage,
    read: (l) => (l.isRead ? 'Read' : 'Unread'),
    listingType: (l) => l.listingType,
    propertyType: (l) => l.propertyType,
    zone: (l) => (l.preferredZones || []).map(zoneEntry),
  },
  text: (l) => [
    l.customer?.name,
    l.customer?.phone,
    l.notes,
    l.assignedAgent?.name,
    l.lastFollowUp?.notes,
    ...(l.preferredZones || []).map((z) => z?.name),
  ],
});

module.exports = { searchPosts, searchLeads, leadStage };
