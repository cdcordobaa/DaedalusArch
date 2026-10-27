/**
 * Time-zone helper over the platform's Intl data: which zone each served airport is in, and what the wall clock
 * there shows at a given UTC moment.
 */
const ZONES: Readonly<Record<string, string>> = {
  ZRH: 'Europe/Zurich',
  LIS: 'Europe/Lisbon',
  JFK: 'America/New_York',
  SIN: 'Asia/Singapore',
  NRT: 'Asia/Tokyo',
};

export interface WallClock {
  /** YYYY-MM-DD */
  readonly date: string;
  /** 0-23 */
  readonly hour: number;
  readonly minute: number;
}

export function zoneOf(airport: string): string {
  const zone = ZONES[airport];
  if (zone === undefined) throw new Error(`no time zone known for ${airport}`);
  return zone;
}

/** The wall clock at `airport` at the UTC moment `isoInstant`. */
export function localClock(airport: string, isoInstant: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zoneOf(airport), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(isoInstant));
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')), minute: Number(part('minute')) };
}
