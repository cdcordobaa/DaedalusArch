const FOLLOW_UP_ORDER = {
  BKG_ON_HOLD: 1,
  BKG_PENDING: 2,
  BKG_REJECTED: 3,
} as const;

export function followUpRank(code: string): number {
  return (FOLLOW_UP_ORDER as Record<string, number>)[code] ?? 9;
}
