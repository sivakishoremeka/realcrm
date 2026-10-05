export const colors = {
  primary: '#17214C',
  primaryDark: '#0F1736',
  primaryLight: '#E8EAF3',
  onPrimary: '#FFFFFF',
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#111827',
  textMuted: '#5B6474',
  border: '#E3E6EC',
  danger: '#B91C1C',
  dangerLight: '#FDECEC',
  success: '#15803D',
  warning: '#B45309',
  info: '#1D4ED8',
  accent: '#6D28D9',
  neutral: '#475569',
  overlay: 'rgba(246,247,249,0.8)',
  scrim: 'rgba(17,24,39,0.4)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  control: 12,
  card: 16,
  pill: 999,
};

// Minimum touch target (dp)
export const TOUCH_TARGET = 48;

export const type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, lineHeight: 22, color: colors.text },
  secondary: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textMuted },
};

export const shadow = {
  card: {
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
};

export const statusColors = {
  Lead: colors.info,
  Contacted: colors.warning,
  Customer: colors.success,
  Lost: colors.danger,
  Open: colors.info,
  Matched: colors.warning,
  Assigned: colors.success,
  Closed: colors.neutral,
  Available: colors.success,
  Hold: colors.warning,
  Deal: colors.accent,
  Blocked: colors.neutral,
  Sold: colors.danger,
  Draft: colors.textMuted,
};

// Whole-card status colouring (My Properties, Leads). Statuses not listed stay
// on the plain surface and show their name instead.
export const statusCardColors = {
  Available: { background: '#E6F4EA', edge: colors.success },
  Sold: { background: colors.dangerLight, edge: colors.danger },
  Deal: { background: '#F1E6DA', edge: '#7C4A21' },
  // Lead stages; New stays white.
  Matched: { background: '#E6F4EA', edge: colors.success },
  Sent: { background: '#E9ECF0', edge: colors.neutral },
};
