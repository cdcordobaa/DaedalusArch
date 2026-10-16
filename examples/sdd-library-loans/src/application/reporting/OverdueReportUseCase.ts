import type { BookRepository } from '../ports/BookRepository';
import type { Clock } from '../ports/Clock';
import type { MemberRepository } from '../ports/MemberRepository';
import type { OverdueLoansQuery } from '../ports/OverdueLoansQuery';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface OverdueLine {
  readonly loanId: string;
  readonly isbn: string;
  readonly title: string;
  readonly memberName: string;
  readonly memberEmail: string;
  readonly dueAt: Date;
  readonly daysLate: number;
}

export class OverdueReportUseCase {
  constructor(
    private readonly overdueLoans: OverdueLoansQuery,
    private readonly books: BookRepository,
    private readonly members: MemberRepository,
    private readonly clock: Clock,
  ) {}

  async execute(asOf?: Date): Promise<OverdueLine[]> {
    const at = asOf ?? this.clock.now();
    const lines: OverdueLine[] = [];
    for (const loan of await this.overdueLoans.findOpenDueBefore(at)) {
      const book = await this.books.findByIsbn(loan.isbn);
      const member = await this.members.findById(loan.memberId);
      lines.push({
        loanId: loan.id,
        isbn: loan.isbn.value,
        title: book?.title ?? '(unknown book)',
        memberName: member?.name ?? '(unknown member)',
        memberEmail: member?.email.value ?? '',
        dueAt: loan.dueAt,
        daysLate: Math.floor((at.getTime() - loan.dueAt.getTime()) / DAY_MS),
      });
    }
    return lines.sort((a, b) => b.daysLate - a.daysLate);
  }
}
