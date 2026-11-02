import { FlightError } from '../errors/FlightError';

/** What a seat costs, and what a passenger needs to fly. */
export class Basket {
  static readonly SEAT_PRICE = 180;

  static readonly CAPACITY = 8;

  isFull(seatCount: number): boolean {
    return seatCount >= Basket.CAPACITY;
  }

  passenger(name: string): string {
    const n = name.trim();
    if (n === '') throw new FlightError('a seat needs a passenger name');
    return n;
  }

  day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new FlightError('a flight day is written YYYY-MM-DD');
    return day;
  }
}
