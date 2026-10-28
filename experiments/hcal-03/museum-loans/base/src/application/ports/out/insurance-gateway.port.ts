import { InsuranceQuote } from '../../../domain/insurance-quote';
import { LoanRequest } from '../../../domain/loan-request';

export interface InsuranceGateway {
  quote(loan: LoanRequest): Promise<InsuranceQuote>;
}
