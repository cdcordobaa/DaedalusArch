import type { Member } from './member';

/** Gold tier: a standard member who spent at least 1000 this year and has been active for two years or more. */
export class GoldEligibility {
  isSatisfiedBy(m: Member): boolean {
    return m.currentTier === 'standard' && m.annualSpend >= 1000 && m.yearsActive >= 2;
  }
}
