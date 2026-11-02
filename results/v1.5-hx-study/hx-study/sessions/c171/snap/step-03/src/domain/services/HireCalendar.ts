import type { Hire } from '../model/Hire';

const DAY_MS = 86_400_000;

function startDay(from: string): number {
  return Math.floor(Date.parse(from + 'T00:00:00Z') / DAY_MS);
}

/** True when two hires of a boat share a night; a hire ends on the morning after its last night. */
export function sharesNights(a: Pick<Hire, 'from' | 'nights'>, b: Pick<Hire, 'from' | 'nights'>): boolean {
  const aStart = startDay(a.from);
  const bStart = startDay(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}
