import type { AxiosResponse } from 'axios';
import { InsuranceQuote } from '../../../domain/insurance-quote';

export interface QuoteArchive {
  fetchRemote(loanId: string): Promise<AxiosResponse<InsuranceQuote>>;
}
