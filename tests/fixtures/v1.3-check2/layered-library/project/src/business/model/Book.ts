import { LendingError } from '../errors/LendingError';

export class Book {
  isbn: string;
  title: string;
  author: string;
  copiesAvailable: number;

  constructor(isbn: string, title: string, author: string, copiesAvailable: number) {
    this.isbn = isbn;
    this.title = title;
    this.author = author;
    this.copiesAvailable = copiesAvailable;
  }

  checkOut(): void {
    if (this.copiesAvailable === 0) throw new LendingError('CONFLICT', `No copy of ${this.title} is available`);
    this.copiesAvailable -= 1;
  }

  checkIn(): void {
    this.copiesAvailable += 1;
  }
}
