import { CastBooking } from '../cast-booking/CastBooking';

export class Actor {
  private _name: string;
  private _engagements = 0;
  private _bookings: CastBooking[] = [];

  constructor(
    readonly id: string,
    name: string,
    readonly agentEmail: string,
  ) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get engagements(): number {
    return this._engagements;
  }

  setName(name: string): void {
    if (name.trim() === '') {
      throw new Error('name required');
    }
    this._name = name;
  }

  get bookings(): readonly CastBooking[] {
    return this._bookings;
  }

  addBooking(booking: CastBooking): void {
    this._bookings.push(booking);
  }

  startEngagement(): void {
    this._engagements += 1;
  }
}
