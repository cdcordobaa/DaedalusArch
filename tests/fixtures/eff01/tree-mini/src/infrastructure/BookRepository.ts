import type { Book } from '../domain/Book';
import type { IBookRepository } from '../domain/IBookRepository';

export class BookRepository implements IBookRepository {
  private readonly rows = new Map<string, Book>();

  async save(book: Book): Promise<void> {
    this.rows.set(book.id, book);
  }
}
