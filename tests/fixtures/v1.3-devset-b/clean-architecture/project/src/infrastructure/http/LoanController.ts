import { BorrowBookUseCase } from '../../application/use-cases/BorrowBookUseCase';
import { ListOverdueLoansUseCase } from '../../application/use-cases/ListOverdueLoansUseCase';
import { ReturnBookUseCase } from '../../application/use-cases/ReturnBookUseCase';
import { toErrorResponse } from './ErrorMapper';
import { HttpRequest, HttpResponse, created, ok } from './HttpTypes';

export class LoanController {
  constructor(
    private readonly borrowBook: BorrowBookUseCase,
    private readonly returnBook: ReturnBookUseCase,
    private readonly listOverdue: ListOverdueLoansUseCase,
  ) {}

  async borrow(request: HttpRequest): Promise<HttpResponse> {
    try {
      const loan = await this.borrowBook.execute({
        bookId: String(request.body['bookId']),
        memberId: String(request.body['memberId']),
      });
      return created(loan);
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async giveBack(request: HttpRequest): Promise<HttpResponse> {
    try {
      return ok(await this.returnBook.execute(String(request.params['loanId'])));
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async overdue(): Promise<HttpResponse> {
    return ok(await this.listOverdue.execute());
  }
}
