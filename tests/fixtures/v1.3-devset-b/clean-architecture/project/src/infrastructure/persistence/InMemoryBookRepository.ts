import { Book } from '../../domain/entities/Book';
import { BookRepository } from '../../domain/repositories/BookRepository';

export class InMemoryBookRepository implements BookRepository {
  private readonly rows = new Map<string, Book>();

  async findById(id: string): Promise<Book | undefined> {
    return this.rows.get(id);
  }

  async save(book: Book): Promise<void> {
    this.rows.set(book.id, book);
  }
}
