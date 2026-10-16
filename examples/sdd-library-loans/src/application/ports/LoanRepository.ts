import type { Isbn } from '../../domain/catalog/Isbn';
import type { Loan } from '../../domain/lending/Loan';

/** Outbound port: where loans are kept. */
export interface LoanRepository {
  nextId(): Promise<string>;
  save(loan: Loan): Promise<void>;
  findById(id: string): Promise<Loan | undefined>;
  findOpenByMember(memberId: string): Promise<Loan[]>;
  countOpenByIsbn(isbn: Isbn): Promise<number>;
  countOpenByMember(memberId: string): Promise<number>;
}
