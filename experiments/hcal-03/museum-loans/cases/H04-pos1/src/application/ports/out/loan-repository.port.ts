import type { PoolClient } from 'pg';
import { LoanRequest } from '../../../domain/loan-request';

export interface LoanRepository {
  save(loan: LoanRequest, tx?: PoolClient): Promise<void>;
  findById(id: string): Promise<LoanRequest | null>;
}
