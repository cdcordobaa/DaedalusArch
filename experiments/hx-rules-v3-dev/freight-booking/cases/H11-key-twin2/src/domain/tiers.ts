export const TIER_DISCOUNT = {
  A1: 0.1,
  B2: 0.05,
  standard: 0,
} as const;

export function discountOf(tier: string): number {
  return (TIER_DISCOUNT as Record<string, number>)[tier] ?? 0;
}
