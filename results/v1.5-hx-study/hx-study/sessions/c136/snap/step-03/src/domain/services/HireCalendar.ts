import type { Hire } from '../model/Hire';

const DAY_MS = 86_400_000;

function startDay(from: string): number {
  const [y, m, d] = from.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Two hires of the same boat clash when they share a night; a hire may start on the morning the other ends. */
export function sameBoatSharesNights(a: Hire, b: Hire): boolean {
  if (a.boatId !== b.boatId) return false;
  const aStart = startDay(a.from);
  const bStart = startDay(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}
