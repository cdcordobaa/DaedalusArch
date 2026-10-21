/** The tiers orders know about, as published by the club. */
export type CustomerTier = 'gold' | 'silver' | 'standard';

const DISCOUNT_RATE: Record<CustomerTier, number> = { gold: 0.1, silver: 0.05, standard: 0 };

export function discountRateOf(tier: CustomerTier): number {
  return DISCOUNT_RATE[tier];
}
