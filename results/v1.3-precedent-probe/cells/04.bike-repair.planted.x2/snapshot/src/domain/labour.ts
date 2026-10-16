export const HOURLY_RATE_CENTS = 4500;

export function labourCents(hours: number): number {
  if (hours < 0) throw new Error('hours must not be negative');
  return Math.round(hours * 4) / 4 * HOURLY_RATE_CENTS;
}
