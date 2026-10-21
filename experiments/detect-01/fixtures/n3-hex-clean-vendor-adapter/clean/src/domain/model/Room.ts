/** Aggregate root: a hotel room. */
export class Room {
  constructor(readonly id: string, readonly number: string, readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('A room sleeps at least one guest');
  }

  fits(guests: number): boolean {
    return guests <= this.capacity;
  }
}
