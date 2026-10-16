import { ParkingError } from '../errors/ParkingError';

export class Reservation {
  id: string;
  spotCode: string;
  plate: string;
  from: Date;
  hours: number;
  cancelled: boolean;

  constructor(id: string, spotCode: string, plate: string, from: Date, hours: number, cancelled = false) {
    this.id = id;
    this.spotCode = spotCode;
    this.plate = plate;
    this.from = from;
    this.hours = hours;
    this.cancelled = cancelled;
  }

  until(): Date {
    return new Date(this.from.getTime() + this.hours * 3_600_000);
  }

  clashesWith(from: Date, hours: number): boolean {
    const until = new Date(from.getTime() + hours * 3_600_000);
    return !this.cancelled && from < this.until() && this.from < until;
  }

  cancel(now: Date): void {
    if (this.cancelled) throw new ParkingError('invalid', `Reservation ${this.id} is already cancelled`);
    if (now >= this.from) throw new ParkingError('invalid', 'A started reservation cannot be cancelled');
    this.cancelled = true;
  }
}
