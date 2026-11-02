import type { Hire } from '../model/Hire';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(day: string): number {
  return Math.floor(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS);
}

/** A hire occupies the nights [from, from + nights); it ends on the morning of the day after its last night. */
export function sharesNights(a: Pick<Hire, 'from' | 'nights'>, b: Pick<Hire, 'from' | 'nights'>): boolean {
  const aStart = dayNumber(a.from);
  const bStart = dayNumber(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}

/** True when another hire of the same boat already has any of the candidate's nights. */
export function clashesWithAny(candidate: Hire, existing: Iterable<Hire>): boolean {
  for (const other of existing) {
    if (other.hireId !== candidate.hireId && other.boatId === candidate.boatId && sharesNights(candidate, other)) return true;
  }
  return false;
}
