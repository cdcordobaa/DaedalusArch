import { Book } from '../entities/Book';

export interface BookRepository {
  findById(id: string): Promise<Book | undefined>;
  save(book: Book): Promise<void>;
}
