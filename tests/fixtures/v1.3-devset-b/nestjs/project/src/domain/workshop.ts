import { DomainError } from './domain-error';

export class Workshop {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly capacity: number,
    readonly startsAt: Date,
    private seatsTaken = 0,
  ) {
    if (capacity < 1) throw new DomainError('invalid', 'A workshop needs at least one seat');
  }

  get seatsLeft(): number {
    return this.capacity - this.seatsTaken;
  }

  takeSeat(): void {
    if (this.seatsLeft === 0) throw new DomainError('conflict', `Workshop "${this.title}" is full`);
    this.seatsTaken += 1;
  }

  releaseSeat(): void {
    if (this.seatsTaken > 0) this.seatsTaken -= 1;
  }
}
