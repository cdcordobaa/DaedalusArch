import { Money } from './Money';

export class Room {
  constructor(
    readonly id: string,
    readonly number: string,
    readonly nightlyRate: Money,
    readonly capacity: number,
  ) {}

  fits(guests: number): boolean {
    return guests >= 1 && guests <= this.capacity;
  }
}
