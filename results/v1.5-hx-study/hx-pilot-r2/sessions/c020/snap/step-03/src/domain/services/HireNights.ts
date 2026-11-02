import type { Hire } from '../model/Hire';

const DAY_MS = 24 * 60 * 60 * 1000;

function startDay(from: string): number {
  return Math.floor(Date.parse(from + 'T00:00:00Z') / DAY_MS);
}

/** True when two hires of the same boat share a night. A hire occupies the nights from its first day up to, not including, the morning it ends. */
export function sharesNights(a: Pick<Hire, 'from' | 'nights'>, b: Pick<Hire, 'from' | 'nights'>): boolean {
  const aStart = startDay(a.from);
  const bStart = startDay(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}
