import type { Hire } from '../model/Hire';

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Math.floor(Date.parse(day + 'T00:00:00Z') / DAY_MS);
}

/** Two hires clash when they share a night; a hire ending on the morning another starts does not clash. */
export function sharesNights(a: Pick<Hire, 'from' | 'nights'>, b: Pick<Hire, 'from' | 'nights'>): boolean {
  const aStart = dayNumber(a.from);
  const bStart = dayNumber(b.from);
  return aStart < bStart + b.nights && bStart < aStart + a.nights;
}

/** Whether the boat is already out on any of the nights of the new hire; a returned hire no longer holds the boat. */
export function boatIsBooked(existing: readonly Hire[], wanted: Hire): boolean {
  return existing.some((h) => h.hireId !== wanted.hireId && h.state !== 'returned' && sharesNights(h, wanted));
}
