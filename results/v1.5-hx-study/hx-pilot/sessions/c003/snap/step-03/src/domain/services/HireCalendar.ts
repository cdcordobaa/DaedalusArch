import type { Hire } from '../model/Hire';

const DAY_MS = 86_400_000;

function startDay(from: string): number {
  const [y, m, d] = from.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** True when two hires share a night. A hire ends on the morning after its last night, so back-to-back hires do not clash. */
export function sameNights(a: Pick<Hire, 'from' | 'nights'>, b: Pick<Hire, 'from' | 'nights'>): boolean {
  const aStart = startDay(a.from);
  const bStart = startDay(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}
