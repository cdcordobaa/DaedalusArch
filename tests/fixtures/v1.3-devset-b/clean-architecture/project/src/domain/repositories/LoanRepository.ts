import { Loan } from '../entities/Loan';

export interface LoanRepository {
  findById(id: string): Promise<Loan | undefined>;
  findActiveByMember(memberId: string): Promise<Loan[]>;
  findActive(): Promise<Loan[]>;
  save(loan: Loan): Promise<void>;
}
