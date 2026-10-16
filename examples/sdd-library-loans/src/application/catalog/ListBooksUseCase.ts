import type { Book } from '../../domain/catalog/Book';
import type { BookRepository } from '../ports/BookRepository';

export class ListBooksUseCase {
  constructor(private readonly books: BookRepository) {}

  async execute(): Promise<Book[]> {
    const all = await this.books.findAll();
    return [...all].sort((a, b) => a.title.localeCompare(b.title));
  }
}
