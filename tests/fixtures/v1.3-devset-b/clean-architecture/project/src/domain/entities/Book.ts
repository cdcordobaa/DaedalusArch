import { DomainError } from '../errors/DomainError';
import { Isbn } from '../value-objects/Isbn';

export class Book {
  constructor(
    readonly id: string,
    readonly isbn: Isbn,
    readonly title: string,
    readonly author: string,
    private availableCopies: number,
  ) {
    if (title.trim().length === 0) throw new DomainError('INVALID_BOOK', 'A book needs a title');
    if (availableCopies < 0) throw new DomainError('INVALID_BOOK', 'Copies cannot be negative');
  }

  get copiesAvailable(): number {
    return this.availableCopies;
  }

  checkOut(): void {
    if (this.availableCopies === 0) {
      throw new DomainError('NO_COPIES', `No copy of "${this.title}" is available`);
    }
    this.availableCopies -= 1;
  }

  checkIn(): void {
    this.availableCopies += 1;
  }
}
