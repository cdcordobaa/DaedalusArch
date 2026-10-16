import { DomainError } from '../../shared/domain/domain-error';

/** Longest inbound loan the insurer covers without a separate policy. */
export const MAX_LOAN_DAYS = 730;

export const LOAN_CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF'] as const;

export type LoanCurrency = (typeof LOAN_CURRENCIES)[number];

export function isLoanCurrency(value: string): value is LoanCurrency {
  return (LOAN_CURRENCIES as readonly string[]).includes(value);
}

export class UnsupportedCurrencyError extends DomainError {
  constructor(currency: string) {
    super('UNSUPPORTED_CURRENCY', `Loans are insured in ${LOAN_CURRENCIES.join(', ')}; got ${currency}`);
  }
}

export class LoanTooLongError extends DomainError {
  constructor(days: number) {
    super('LOAN_TOO_LONG', `A loan may last at most ${String(MAX_LOAN_DAYS)} days; requested ${String(days)}`);
  }
}
