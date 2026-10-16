import { Book } from '../../domain/catalog/Book';
import { DuplicateBookError } from '../../domain/catalog/errors';
import { Isbn } from '../../domain/catalog/Isbn';
import type { BookRepository } from '../ports/BookRepository';

export interface RegisterBookCommand {
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly copies: number;
}

export class RegisterBookUseCase {
  constructor(private readonly books: BookRepository) {}

  async execute(cmd: RegisterBookCommand): Promise<Book> {
    const isbn = Isbn.of(cmd.isbn);
    if ((await this.books.findByIsbn(isbn)) !== undefined) throw new DuplicateBookError(isbn.value);
    const book = Book.register(isbn, cmd.title, cmd.author, cmd.copies);
    await this.books.save(book);
    return book;
  }
}
