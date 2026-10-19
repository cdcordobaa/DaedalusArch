import type { Book } from './Book';

export interface IBookRepository {
  save(book: Book): Promise<void>;
}
