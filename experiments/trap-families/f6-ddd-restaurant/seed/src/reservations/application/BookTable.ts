import { Reservation } from '../domain/reservation/Reservation';
import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import type { GuestDirectory } from './ports/GuestDirectory';

export interface BookedTable {
  readonly reservationId: string;
  readonly deposit: number;
}

export class BookTable {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly directory: GuestDirectory,
  ) {}

  /** Refused: a guest id that has no guest profile (a booking without a profile passes null). */
  execute(guestId: string | null, partySize: number, currency = 'EUR'): BookedTable {
    if (guestId !== null && !this.directory.exists(guestId)) throw new Error(`no guest ${guestId}`);
    const reservation = Reservation.book(this.reservations.nextId(), guestId, partySize, currency);
    this.reservations.save(reservation);
    return { reservationId: reservation.id.value, deposit: reservation.deposit().amount() };
  }
}
