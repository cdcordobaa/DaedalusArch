import type { ListBooksUseCase } from '../../../application/catalog/ListBooksUseCase';
import type { RegisterBookUseCase } from '../../../application/catalog/RegisterBookUseCase';
import type { Book } from '../../../domain/catalog/Book';
import { errorResponse, field } from './http';
import type { HttpRequest, HttpResponse } from './http';

const toJson = (b: Book) => ({ isbn: b.isbn.value, title: b.title, author: b.author, copies: b.copies });

/** POST /books, GET /books */
export class BookController {
  constructor(
    private readonly registerBook: RegisterBookUseCase,
    private readonly listBooks: ListBooksUseCase,
  ) {}

  async register(req: HttpRequest): Promise<HttpResponse> {
    try {
      const book = await this.registerBook.execute({
        isbn: String(field(req.body, 'isbn') ?? ''),
        title: String(field(req.body, 'title') ?? ''),
        author: String(field(req.body, 'author') ?? ''),
        copies: Number(field(req.body, 'copies') ?? 1),
      });
      return { status: 201, body: toJson(book) };
    } catch (err) {
      return errorResponse(err);
    }
  }

  async list(_req: HttpRequest): Promise<HttpResponse> {
    const books = await this.listBooks.execute();
    return { status: 200, body: books.map(toJson) };
  }
}
