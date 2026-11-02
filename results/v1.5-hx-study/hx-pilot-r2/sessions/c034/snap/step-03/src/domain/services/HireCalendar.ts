import type { Hire } from '../model/Hire';

const DAY_MS = 24 * 60 * 60 * 1000;

function startDay(from: string): number {
  const [y, m, d] = from.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/**
 * Whether two hires of the same boat share a night. A hire occupies the nights from its
 * start day up to, but not including, the morning it ends, so a hire may start on the
 * morning the previous one ends.
 */
export function sharesNights(a: Hire, b: Hire): boolean {
  if (a.boatId !== b.boatId) return false;
  const aStart = startDay(a.from);
  const bStart = startDay(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}
