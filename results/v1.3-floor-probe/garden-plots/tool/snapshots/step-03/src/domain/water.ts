export interface MeterReading {
  meterId: string;
  plotNumber: number;
  litres: number;
  time: string;
}

export const WEEKLY_WARNING_LITRES = 2000;

/** Monday (UTC) of the week the date falls in, as YYYY-MM-DD. */
export function weekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function weeklyUse(readings: MeterReading[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of readings) {
    const w = weekStart(new Date(r.time));
    out[w] = (out[w] ?? 0) + r.litres;
  }
  return out;
}
