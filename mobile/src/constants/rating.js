/** Color-coded ring for 1–5 star community ratings */
export const RATING_COLORS = {
  0: '#94A3B8', // no ratings — slate
  1: '#DC2626', // red
  2: '#EA580C', // orange
  3: '#CA8A04', // amber/gold
  4: '#16A34A', // green
  5: '#0F766E', // teal (excellent)
};

export function ratingBucket(avg) {
  if (avg == null || Number.isNaN(Number(avg)) || Number(avg) <= 0) return 0;
  return Math.min(5, Math.max(1, Math.round(Number(avg))));
}

export function ratingColor(avg) {
  return RATING_COLORS[ratingBucket(avg)];
}

export function starsLabel(avg, count) {
  if (!count) return 'No ratings yet';
  return `${Number(avg).toFixed(1)} · ${count} review${count === 1 ? '' : 's'}`;
}
