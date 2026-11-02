import type { Hire } from '../model/Hire';

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(date + 'T00:00:00Z') / DAY_MS);
}

/** Whether two hires of the same boat have a night in common. A hire ends on the morning after its last night. */
export function sharesNights(a: Pick<Hire, 'from' | 'nights'>, b: Pick<Hire, 'from' | 'nights'>): boolean {
  const aStart = dayNumber(a.from);
  const bStart = dayNumber(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}
