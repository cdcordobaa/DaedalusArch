import type { Hire } from '../model/Hire';

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Math.floor(Date.parse(day + 'T00:00:00Z') / DAY_MS);
}

/** True when two hires of the same boat share a night. A hire occupies the nights from its first day up to, not including, the morning it ends. */
export function sharesNights(a: Pick<Hire, 'from' | 'nights'>, b: Pick<Hire, 'from' | 'nights'>): boolean {
  const aStart = dayNumber(a.from);
  const bStart = dayNumber(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}
