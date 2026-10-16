import type { BookRepository } from '../../../application/ports/BookRepository';
import type { Book } from '../../../domain/catalog/Book';
import type { Isbn } from '../../../domain/catalog/Isbn';

export class InMemoryBookRepository implements BookRepository {
  private readonly byIsbn = new Map<string, Book>();

  async save(book: Book): Promise<void> {
    this.byIsbn.set(book.isbn.value, book);
  }

  async findByIsbn(isbn: Isbn): Promise<Book | undefined> {
    return this.byIsbn.get(isbn.value);
  }

  async findAll(): Promise<Book[]> {
    return [...this.byIsbn.values()];
  }
}
