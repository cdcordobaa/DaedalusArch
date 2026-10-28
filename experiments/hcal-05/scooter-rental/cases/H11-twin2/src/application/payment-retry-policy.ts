import { ChargeOutcome } from '../domain/charge-outcome';

const RETRYABLE_OUTCOMES: ReadonlySet<ChargeOutcome> = new Set<ChargeOutcome>(['under-review', 'unavailable']);

export function shouldRetry(outcome: ChargeOutcome): boolean {
  return RETRYABLE_OUTCOMES.has(outcome);
}
