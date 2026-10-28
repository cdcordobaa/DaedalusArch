import { LoanRequest } from '../../../domain/loan-request';

export interface LoanRepository {
  save(loan: LoanRequest): Promise<void>;
  findById(id: string): Promise<LoanRequest | null>;
}
