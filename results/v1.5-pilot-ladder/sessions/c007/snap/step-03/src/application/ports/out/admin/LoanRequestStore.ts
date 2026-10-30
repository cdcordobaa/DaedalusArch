import type { LoanRequest } from '../../../../domain/model/admin/LoanRequest';

export interface LoanRequestStore {
  add(item: LoanRequest): Promise<void>;
  all(): Promise<LoanRequest[]>;
}
