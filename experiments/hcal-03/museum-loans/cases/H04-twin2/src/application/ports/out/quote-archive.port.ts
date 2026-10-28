import { InsuranceQuote } from '../../../domain/insurance-quote';

export interface QuoteArchive {
  fetchRemote(loanId: string): Promise<InsuranceQuote>;
}
