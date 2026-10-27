import type { LatLng } from './geo';

/** Where a rider's tracker last placed them, and when. */
export interface PositionFix {
  readonly at: LatLng;
  readonly takenAt: Date;
}

/** A position older than this does not count. */
export const RECENT_FOR_MS = 10 * 60_000;

export function isRecent(fix: PositionFix, now: Date): boolean {
  return now.getTime() - fix.takenAt.getTime() <= RECENT_FOR_MS;
}

/** Average riding speed in town (15 km/h) and the handover at the door. */
const METERS_PER_MINUTE = 250;
const HANDOVER_MINUTES = 2;

export function minutesToArrive(meters: number): number {
  return Math.ceil(meters / METERS_PER_MINUTE) + HANDOVER_MINUTES;
}
