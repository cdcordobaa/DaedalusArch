import { CanteenError } from '../errors/CanteenError';

/** A calendar day written YYYY-MM-DD. */
export type SchoolDate = string;

export function requireDate(value: unknown): SchoolDate {
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m === null) throw new CanteenError(`not a date: ${s}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.toISOString().slice(0, 10) !== s) throw new CanteenError(`not a date: ${s}`);
  return s;
}
