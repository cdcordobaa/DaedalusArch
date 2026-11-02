import type { Hire } from '../model/Hire';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(day: string): number {
  return Math.floor(Date.parse(day + 'T00:00:00Z') / DAY_MS);
}

/** Two hires clash when they share a night. A hire ends on the morning after its last night, so the next may start that day. */
export function sharesNights(a: Pick<Hire, 'from' | 'nights'>, b: Pick<Hire, 'from' | 'nights'>): boolean {
  const aStart = dayNumber(a.from);
  const bStart = dayNumber(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}
