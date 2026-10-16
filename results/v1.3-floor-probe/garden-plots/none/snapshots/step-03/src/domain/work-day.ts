export interface WorkDay {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  signedUp: string[];
  present: string[];
}

export const MIN_WORK_DAYS_PER_YEAR = 2;
export const SURCHARGE_RATE = 0.2;

export function attendedInPastYear(days: WorkDay[], gardenerId: string, now: Date): number {
  const yearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  return days.filter((d) => d.date >= yearAgo && d.date <= today && d.present.includes(gardenerId)).length;
}

export function feeWithSurcharge(baseFee: number, attended: number): number {
  return attended < MIN_WORK_DAYS_PER_YEAR ? Math.round(baseFee * (1 + SURCHARGE_RATE) * 100) / 100 : baseFee;
}
