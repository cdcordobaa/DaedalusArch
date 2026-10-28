import { InvalidRequest } from '../errors/LoungeErrors';

/** A point in time, held as an ISO-8601 UTC string (2026-10-27T20:30:00.000Z). */
export type Instant = string & { readonly __brand: 'Instant' };

export function instant(iso: string): Instant {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new InvalidRequest(`not a time: ${iso}`);
  return new Date(ms).toISOString() as Instant;
}

/** Minutes from `from` to `to` (negative when `to` is earlier), with fractions. */
export function minutesBetween(from: Instant, to: Instant): number {
  return (Date.parse(to) - Date.parse(from)) / 60_000;
}
