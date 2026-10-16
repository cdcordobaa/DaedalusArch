import type { Route, Stop } from "./route.js";

export interface Position {
  unitId: string;
  latitude: number;
  longitude: number;
  time: Date;
}

export interface StopPassage {
  stopIndex: number;
  /** Minutes late (negative = early) when the bus passed the stop. */
  delayMinutes: number;
  passedAt: Date;
}

/** A unit linked to the route it drives on a given day. */
export interface BusRun {
  unitId: string;
  routeId: string;
  date: string; // YYYY-MM-DD
  lastPassage?: StopPassage;
  lastPosition?: Position;
}

export const STOP_RADIUS_METERS = 100;

export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function minutesOfDay(time: Date, utcOffsetMinutes: number): number {
  const shifted = new Date(time.getTime() + utcOffsetMinutes * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes() + shifted.getUTCSeconds() / 60;
}

/**
 * Applies a GPS fix to the run: if the bus is at a stop further along the
 * route than the last one passed, records the passage and its delay.
 */
export function applyPosition(run: BusRun, route: Route, position: Position, utcOffsetMinutes: number): void {
  run.lastPosition = position;
  const from = run.lastPassage ? run.lastPassage.stopIndex + 1 : 0;
  for (let i = from; i < route.stops.length; i++) {
    const stop = route.stops[i] as Stop;
    if (distanceMeters(stop.latitude, stop.longitude, position.latitude, position.longitude) <= STOP_RADIUS_METERS) {
      run.lastPassage = {
        stopIndex: i,
        delayMinutes: minutesOfDay(position.time, utcOffsetMinutes) - stop.scheduledMinutes,
        passedAt: position.time,
      };
      return;
    }
  }
}

export interface Estimate {
  status: "estimated" | "passed" | "no-live-data";
  delayMinutes: number;
  estimatedMinutes: number;
}

export function estimateArrival(run: BusRun | undefined, route: Route, stopId: string): Estimate {
  const index = route.stops.findIndex((s) => s.id === stopId);
  const stop = route.stops[index] as Stop;
  if (!run) return { status: "no-live-data", delayMinutes: 0, estimatedMinutes: stop.scheduledMinutes };
  const passage = run.lastPassage;
  if (passage && passage.stopIndex >= index) {
    return { status: "passed", delayMinutes: passage.delayMinutes, estimatedMinutes: stop.scheduledMinutes + passage.delayMinutes };
  }
  const delay = passage ? passage.delayMinutes : 0;
  return { status: "estimated", delayMinutes: delay, estimatedMinutes: stop.scheduledMinutes + delay };
}
