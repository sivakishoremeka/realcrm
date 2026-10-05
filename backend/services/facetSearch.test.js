const test = require('node:test');
const assert = require('node:assert/strict');
const { searchPosts, searchLeads, leadStage } = require('./facetSearch');

const gachibowli = { _id: 'z1', name: 'Gachibowli' };
const kondapur = { _id: 'z2', name: 'Kondapur' };

const posts = [
  { title: 'Lake view flat', type: 'Apartment', listingType: 'Sale', status: 'Available', bhk: 3, price: 9000000, zone: gachibowli, postAs: 'agent', address: 'Road 2', notes: '' },
  { title: 'Corner villa', type: 'Villa', listingType: 'Sale', status: 'Hold', bhk: 4, price: 25000000, zone: kondapur, postAs: 'owner', address: '', notes: 'near lake' },
  { title: 'Studio', type: 'Apartment', listingType: 'Rent', status: 'Available', bhk: 1, price: 20000, zone: kondapur, postAs: 'agent', address: '', notes: '' },
  { title: 'Open plot', type: 'Plot', listingType: 'Sale', status: 'Draft', bhk: null, price: 5000000, zone: gachibowli, postAs: 'owner', address: '', notes: '' },
];

const count = (facet, value) => facet.find((f) => f.value === value)?.count;

test('returns everything with full facet counts when no filters are given', () => {
  const { items, facets, total } = searchPosts(posts);
  assert.equal(items.length, 4);
  assert.equal(total, 4);
  assert.equal(count(facets.type, 'Apartment'), 2);
  assert.equal(count(facets.postAs, 'owner'), 2);
  assert.deepEqual(facets.zone.map((f) => f.label), ['Gachibowli', 'Kondapur']);
  assert.deepEqual(facets.bhk.map((f) => f.value), ['1', '3', '4']);
});

test('a facet keeps its other options but narrows the other facets', () => {
  const { items, facets } = searchPosts(posts, { type: 'Apartment' });
  assert.deepEqual(items.map((p) => p.title), ['Lake view flat', 'Studio']);
  assert.equal(count(facets.type, 'Villa'), 1);
  assert.equal(count(facets.status, 'Hold'), undefined);
  assert.equal(count(facets.status, 'Available'), 2);
});

test('supports multiple values per facet and combines facets with AND', () => {
  const { items } = searchPosts(posts, { status: 'Available,Hold', listingType: ['Sale'] });
  assert.deepEqual(items.map((p) => p.title), ['Lake view flat', 'Corner villa']);
});

test('text search covers title, address, notes and zone name', () => {
  assert.equal(searchPosts(posts, { q: 'LAKE' }).items.length, 2);
  assert.equal(searchPosts(posts, { q: 'kondapur' }).items.length, 2);
});

test('price range applies and bad numbers are ignored', () => {
  const { items } = searchPosts(posts, { minPrice: '1000000', maxPrice: '10000000' });
  assert.deepEqual(items.map((p) => p.title), ['Lake view flat', 'Open plot']);
  assert.equal(searchPosts(posts, { minPrice: 'abc', maxPrice: '' }).items.length, 4);
});

test('object-shaped query values match nothing instead of throwing', () => {
  assert.equal(searchPosts(posts, { status: { $ne: 'Sold' } }).items.length, 0);
});

const me = 'u1';
const leads = [
  { status: 'Open', createdBy: me, leadGenerator: me, assignedAgent: null, listingType: 'Sale', propertyType: 'Villa', preferredZones: [gachibowli, kondapur], customer: { name: 'Ravi', phone: '99887' }, notes: '' },
  { status: 'Matched', createdBy: me, leadGenerator: me, assignedAgent: null, listingType: 'Rent', propertyType: 'Any', preferredZones: [kondapur], customer: { name: 'Sita' }, notes: 'needs parking' },
  { status: 'Assigned', createdBy: { _id: me }, leadGenerator: me, assignedAgent: { _id: 'u2', name: 'Kiran' }, listingType: 'Sale', propertyType: 'Plot', preferredZones: [], customer: { name: 'Anil' }, notes: '' },
  { status: 'Assigned', createdBy: 'u3', leadGenerator: 'u3', assignedAgent: me, listingType: 'Sale', propertyType: 'Villa', preferredZones: [gachibowli], customer: { name: 'Meena' }, notes: '', lastFollowUp: { notes: 'call back Monday' } },
  { status: 'Closed', createdBy: me, leadGenerator: me, assignedAgent: 'u2', listingType: 'Sale', propertyType: 'Villa', preferredZones: [], customer: null, notes: '' },
].map((lead, i) => ({ ...lead, stage: leadStage(lead, me), isRead: i % 2 === 0 }));

test('leadStage separates new, matched, sent to others, assigned to me and closed', () => {
  assert.deepEqual(leads.map((l) => l.stage), ['New', 'Matched', 'Sent', 'Assigned', 'Closed']);
});

test('lead facets count each preferred zone and the read state', () => {
  const { facets, total } = searchLeads(leads);
  assert.equal(total, 5);
  assert.equal(count(facets.zone, 'z1'), 2);
  assert.equal(count(facets.zone, 'z2'), 2);
  assert.equal(count(facets.read, 'Unread'), 2);
  assert.equal(count(facets.stage, 'Sent'), 1);
});

test('lead search filters by zone, stage and text incl. buyer, agent and follow-up', () => {
  assert.deepEqual(searchLeads(leads, { zone: 'z2' }).items.map((l) => l.customer.name), ['Ravi', 'Sita']);
  assert.equal(searchLeads(leads, { stage: 'Sent,Closed' }).items.length, 2);
  assert.equal(searchLeads(leads, { q: 'kiran' }).items[0].customer.name, 'Anil');
  assert.equal(searchLeads(leads, { q: 'monday' }).items[0].customer.name, 'Meena');
  assert.equal(searchLeads(leads, { q: '9988' }).items.length, 1);
});
