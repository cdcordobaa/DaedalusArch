import { InvalidBookError } from './errors';
import { Isbn } from './Isbn';

/** A title the library owns, with the number of physical copies. */
export class Book {
  private constructor(
    readonly isbn: Isbn,
    readonly title: string,
    readonly author: string,
    readonly copies: number,
  ) {}

  static register(isbn: Isbn, title: string, author: string, copies: number): Book {
    if (title.trim() === '') throw new InvalidBookError('title is required');
    if (author.trim() === '') throw new InvalidBookError('author is required');
    if (!Number.isInteger(copies) || copies < 1) throw new InvalidBookError('copies must be a whole number of at least 1');
    return new Book(isbn, title.trim(), author.trim(), copies);
  }
}
