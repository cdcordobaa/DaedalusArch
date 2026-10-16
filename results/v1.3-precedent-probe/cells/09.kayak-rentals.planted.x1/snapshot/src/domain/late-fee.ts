export const LATE_FEE_CENTS_PER_HALF_HOUR = 500;
const HALF_HOUR_MS = 30 * 60 * 1000;

/** 5 euros for every started half hour after the booking's end. */
export function lateFeeCents(endsAt: Date, returnedAt: Date): number {
  const lateMs = returnedAt.getTime() - endsAt.getTime();
  if (lateMs <= 0) return 0;
  return Math.ceil(lateMs / HALF_HOUR_MS) * LATE_FEE_CENTS_PER_HALF_HOUR;
}
