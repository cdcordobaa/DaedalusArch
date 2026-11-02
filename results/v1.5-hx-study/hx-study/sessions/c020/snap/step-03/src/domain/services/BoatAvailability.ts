import type { Hire } from '../model/Hire';

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(date + 'T00:00:00Z') / DAY_MS);
}

/** A hire occupies the nights from its first day up to, but not including, the morning it ends. */
export class BoatAvailability {
  static clash(a: Hire, b: Hire): boolean {
    if (a.hireId === b.hireId || a.boatId !== b.boatId) return false;
    const aStart = dayNumber(a.from);
    const bStart = dayNumber(b.from);
    return aStart < bStart + b.nights && bStart < aStart + a.nights;
  }
}
