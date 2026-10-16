import { ValidationError } from "./errors.js";

export interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Scheduled time of day in minutes after midnight. */
  scheduledMinutes: number;
}

export interface Route {
  id: string;
  name: string;
  stops: Stop[];
}

export function parseTimeOfDay(value: string): number {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) throw new ValidationError(`Invalid time "${value}", expected HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatTimeOfDay(minutes: number): string {
  const day = 24 * 60;
  const n = ((Math.round(minutes) % day) + day) % day;
  const h = String(Math.floor(n / 60)).padStart(2, "0");
  const mm = String(n % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

export function validateCoordinates(latitude: unknown, longitude: unknown): void {
  if (
    typeof latitude !== "number" || typeof longitude !== "number" ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180
  ) {
    throw new ValidationError("latitude and longitude must be valid numbers");
  }
}
