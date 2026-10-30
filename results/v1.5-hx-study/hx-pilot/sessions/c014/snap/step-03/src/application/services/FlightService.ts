import type { Flight, Seat } from '../../domain/model/Flight';
import { FlightError } from '../../domain/errors/FlightError';
import { Basket } from '../../domain/services/Basket';
import type { FlightView, FlySeats, ManifestView, SeatView } from '../ports/in/FlySeats';
import type { Flights } from '../ports/out/Flights';
import type { Vouchers } from '../ports/out/Vouchers';

const SEAT_PRICE_EUR = 180;

export class FlightService implements FlySeats {
  constructor(
    private readonly flights: Flights,
    private readonly vouchers: Vouchers,
    private readonly basket: Basket = new Basket(),
  ) {}

  async schedule(flightId: string, day: string): Promise<FlightView> {
    const flight: Flight = { flightId, day: this.basket.day(day), seats: [] };
    await this.flights.save(flight);
    return { flightId, day: flight.day, status: 'scheduled' };
  }

  async requestSeat(flightId: string, passenger: string, voucherCode: string): Promise<SeatView> {
    const f = await this.get(flightId);
    const name = this.basket.passenger(passenger);
    if (f.seats.some((s) => s.passenger === name)) throw new FlightError(name + ' already has a seat on this flight');
    if (this.basket.isFull(f.seats.length)) {
      return { flightId, passenger: name, status: 'flight_full', reason: 'This flight has no free seats.' };
    }
    const voucher = await this.vouchers.find(voucherCode);
    if (!voucher.usableForFlight) {
      return { flightId, passenger: name, status: 'voucher_not_usable', reason: 'This voucher cannot be used for a flight.' };
    }
    const seat: Seat = { passenger: name, voucherCode, voucherValue: voucher.balance, state: 'booked' };
    await this.flights.save({ ...f, seats: [...f.seats, seat] });
    return { flightId, passenger: name, status: seat.state };
  }

  async board(flightId: string, passenger: string): Promise<SeatView> {
    const f = await this.get(flightId);
    const seat = f.seats.find((s) => s.passenger === passenger);
    if (seat === undefined) throw new FlightError('there is no seat for ' + passenger);
    if (seat.state === 'aboard') return { flightId, passenger, status: seat.state };
    const redemption = await this.vouchers.redeem(seat.voucherCode, SEAT_PRICE_EUR, flightId);
    if (redemption.result === 'insufficient_balance') {
      return { flightId, passenger, status: 'top_up_needed', due: redemption.shortBy };
    }
    if (redemption.result !== 'accepted') throw new FlightError('the voucher of ' + passenger + ' could not be redeemed (' + redemption.result + ')');
    const aboard: Seat = { ...seat, state: 'aboard' };
    await this.flights.save({ ...f, seats: f.seats.map((s) => (s === seat ? aboard : s)) });
    return { flightId, passenger, status: aboard.state };
  }

  async manifest(flightId: string): Promise<ManifestView> {
    const f = await this.get(flightId);
    return { flightId, day: f.day, passengers: f.seats.map((s) => ({ passenger: s.passenger, status: s.state, voucherValue: s.voucherValue })) };
  }

  private async get(flightId: string): Promise<Flight> {
    const f = await this.flights.get(flightId);
    if (f === null) throw new FlightError('there is no flight ' + flightId);
    return f;
  }
}
