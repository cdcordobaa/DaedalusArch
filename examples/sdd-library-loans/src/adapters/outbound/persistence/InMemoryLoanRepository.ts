import type { LoanRepository } from '../../../application/ports/LoanRepository';
import type { OverdueLoansQuery } from '../../../application/ports/OverdueLoansQuery';
import type { Isbn } from '../../../domain/catalog/Isbn';
import type { Loan } from '../../../domain/lending/Loan';

export class InMemoryLoanRepository implements LoanRepository, OverdueLoansQuery {
  private readonly byId = new Map<string, Loan>();
  private seq = 0;

  async nextId(): Promise<string> {
    this.seq += 1;
    return `l-${String(this.seq)}`;
  }

  async save(loan: Loan): Promise<void> {
    this.byId.set(loan.id, loan);
  }

  async findById(id: string): Promise<Loan | undefined> {
    return this.byId.get(id);
  }

  async findOpenByMember(memberId: string): Promise<Loan[]> {
    return this.all().filter((l) => l.isOpen && l.memberId === memberId);
  }

  async countOpenByIsbn(isbn: Isbn): Promise<number> {
    return this.all().filter((l) => l.isOpen && l.isbn.value === isbn.value).length;
  }

  async countOpenByMember(memberId: string): Promise<number> {
    return (await this.findOpenByMember(memberId)).length;
  }

  async findOpenDueBefore(at: Date): Promise<Loan[]> {
    return this.all().filter((l) => l.isOpen && l.dueAt.getTime() < at.getTime());
  }

  private all(): Loan[] {
    return [...this.byId.values()];
  }
}
