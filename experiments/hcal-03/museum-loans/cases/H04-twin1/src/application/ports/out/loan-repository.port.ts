import { LoanRequest } from '../../../domain/loan-request';

export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export interface LoanRepository {
  save(loan: LoanRequest, unit?: UnitOfWork): Promise<void>;
  findById(id: string): Promise<LoanRequest | null>;
}
