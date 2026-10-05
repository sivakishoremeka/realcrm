// Android emulator → host machine localhost
export const DEFAULT_API_URL = 'http://10.0.2.2:5000';

export { statusColors as STATUS_COLORS } from './theme';

export const INVENTORY_STATUS_ORDER = [
  'Available',
  'Hold',
  'Deal',
  'Blocked',
  'Sold',
  'Draft',
];

export const INTERACTION_TYPES = ['Call', 'Email', 'Meeting', 'FollowUp', 'SiteVisit', 'WhatsApp'];
export const CARE_INTERACTION_TYPES = ['FollowUp', 'Call', 'WhatsApp', 'SiteVisit', 'Meeting', 'Email'];
export const CUSTOMER_STATUSES = ['Lead', 'Contacted', 'Customer', 'Lost'];
export const PROPERTY_TYPES = ['Apartment', 'Villa', 'Plot', 'Commercial'];
export const PROPERTY_TYPE_LABELS = {
  Apartment: 'Flat',
  Villa: 'Villa',
  Plot: 'Plot',
  Commercial: 'Commercial',
};
export const RESIDENCE_STYLES = ['Gated', 'Independent'];
export const VILLA_TYPES = ['Duplex', 'Triplex', 'Independent House'];
export const FACING_OPTIONS = [
  'East',
  'West',
  'North',
  'South',
  'North-East',
  'North-West',
  'South-East',
  'South-West',
];
export const LISTING_TYPES = ['Sale', 'Rent', 'Lease'];
export const PROPERTY_STATUSES = ['Available', 'Hold', 'Deal', 'Blocked', 'Sold'];
export const OWNER_LISTING_STATUSES = ['Draft', 'Available', 'Hold', 'Sold'];
export const REQUIREMENT_PROPERTY_TYPES = ['Any', 'Apartment', 'Villa', 'Plot', 'Commercial'];
