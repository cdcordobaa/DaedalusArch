import type { Book } from '../../domain/catalog/Book';
import type { Isbn } from '../../domain/catalog/Isbn';

/** Outbound port: where books are kept. */
export interface BookRepository {
  save(book: Book): Promise<void>;
  findByIsbn(isbn: Isbn): Promise<Book | undefined>;
  findAll(): Promise<Book[]>;
}
