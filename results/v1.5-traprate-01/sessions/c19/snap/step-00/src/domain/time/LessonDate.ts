import { SchoolError } from '../SchoolError';

/** A calendar day written YYYY-MM-DD; refused unless it is a real day. */
export function parseDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m === null) throw new SchoolError(`not a date: ${value}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) throw new SchoolError(`not a date: ${value}`);
  return value;
}
