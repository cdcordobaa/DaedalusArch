import { ShelterError } from '../errors/ShelterError';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days are ISO dates (YYYY-MM-DD) in the shelter's own time zone. */
export function requireDay(day: string): string {
  const m = DAY.exec(day);
  if (m === null) throw new ShelterError(`not a day: ${day}`);
  return day;
}

/** Months are written YYYY-MM, month 01 to 12. */
export function requireMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (m === null || Number(m[2]) < 1 || Number(m[2]) > 12) throw new ShelterError(`not a month: ${month}`);
  return month;
}

/** Whole days from `from` to `to` (0 on the same day). */
export function daysBetween(from: string, to: string): number {
  const ms = (d: string): number => {
    const [y, m, dd] = requireDay(d).split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}
