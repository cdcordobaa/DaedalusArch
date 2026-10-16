import type { LendBookUseCase } from '../../../application/lending/LendBookUseCase';
import type { ListMemberLoansUseCase } from '../../../application/lending/ListMemberLoansUseCase';
import type { ReturnBookUseCase } from '../../../application/lending/ReturnBookUseCase';
import type { Loan } from '../../../domain/lending/Loan';
import { errorResponse, field } from './http';
import type { HttpRequest, HttpResponse } from './http';

const day = (d: Date | undefined) => (d === undefined ? null : d.toISOString().slice(0, 10));
const toJson = (l: Loan) => ({
  id: l.id,
  isbn: l.isbn.value,
  memberId: l.memberId,
  loanedAt: day(l.loanedAt),
  dueAt: day(l.dueAt),
  returnedAt: day(l.returnedAt),
});

/** POST /loans, POST /loans/:id/return, GET /members/:id/loans */
export class LoanController {
  constructor(
    private readonly lendBook: LendBookUseCase,
    private readonly returnBook: ReturnBookUseCase,
    private readonly listMemberLoans: ListMemberLoansUseCase,
  ) {}

  async lend(req: HttpRequest): Promise<HttpResponse> {
    try {
      const loan = await this.lendBook.execute({
        isbn: String(field(req.body, 'isbn') ?? ''),
        memberId: String(field(req.body, 'memberId') ?? ''),
      });
      return { status: 201, body: toJson(loan) };
    } catch (err) {
      return errorResponse(err);
    }
  }

  async return(req: HttpRequest): Promise<HttpResponse> {
    try {
      return { status: 200, body: toJson(await this.returnBook.execute(req.params?.id ?? '')) };
    } catch (err) {
      return errorResponse(err);
    }
  }

  async listForMember(req: HttpRequest): Promise<HttpResponse> {
    const loans = await this.listMemberLoans.execute(req.params?.id ?? '');
    return { status: 200, body: loans.map(toJson) };
  }
}
