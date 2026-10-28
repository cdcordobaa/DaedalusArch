import { Money } from './value-objects';

export class InsuranceQuote {
  constructor(
    readonly loanId: string,
    readonly premium: Money,
    readonly insurer: string,
  ) {}
}
