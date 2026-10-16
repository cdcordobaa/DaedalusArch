import { RegisterBookUseCase } from '../../application/use-cases/RegisterBookUseCase';
import { toErrorResponse } from './ErrorMapper';
import { HttpRequest, HttpResponse, created } from './HttpTypes';

export class BookController {
  constructor(private readonly registerBook: RegisterBookUseCase) {}

  async register(request: HttpRequest): Promise<HttpResponse> {
    try {
      const book = await this.registerBook.execute({
        isbn: String(request.body['isbn']),
        title: String(request.body['title']),
        author: String(request.body['author']),
        copies: Number(request.body['copies']),
      });
      return created(book);
    } catch (error) {
      return toErrorResponse(error);
    }
  }
}
