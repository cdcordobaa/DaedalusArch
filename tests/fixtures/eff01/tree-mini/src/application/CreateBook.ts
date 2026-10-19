import { Book } from '../domain/Book';
import type { IBookRepository } from '../domain/IBookRepository';

export class CreateBook {
  constructor(private readonly books: IBookRepository) {}

  async execute(id: string, title: string): Promise<Book> {
    const book = new Book(id, title);
    await this.books.save(book);
    return book;
  }
}
