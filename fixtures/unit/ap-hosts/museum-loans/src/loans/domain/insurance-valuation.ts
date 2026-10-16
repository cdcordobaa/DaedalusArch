import { isLoanCurrency, LoanCurrency, UnsupportedCurrencyError } from './loan-terms';

/** Nail-to-nail insurance value agreed with the lender. */
export class InsuranceValuation {
  readonly amount: number;
  readonly currency: LoanCurrency;

  constructor(amount: number, currency: LoanCurrency) {
    this.amount = amount;
    this.currency = currency;
  }

  /** Rebuilds a stored valuation; the currency was checked when the loan was requested. */
  static of(amount: number, currency: string): InsuranceValuation {
    if (!isLoanCurrency(currency)) {
      throw new UnsupportedCurrencyError(currency);
    }
    return new InsuranceValuation(amount, currency);
  }

  /** Values above the indemnity threshold need the government indemnity scheme instead of commercial cover. */
  needsGovernmentIndemnity(threshold: number): boolean {
    return this.amount >= threshold;
  }
}
