/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { ParkingError } from '../../domain/errors/ParkingError';
import { Reservation } from '../../domain/model/Reservation';
import { ReservationReceipt, ReserveSpot } from '../ports/in/ReserveSpot';
import { PaymentPort } from '../ports/out/PaymentPort';
import { ReservationRepository } from '../ports/out/ReservationRepository';
import { SpotRepository } from '../ports/out/SpotRepository';

export class ReserveSpotService implements ReserveSpot {
  private issued = 0;

  constructor(
    private readonly spots: SpotRepository,
    private readonly reservations: ReservationRepository,
    private readonly payments: PaymentPort,
  ) {}

  async reserve(plate: string, from: Date, hours: number, electric: boolean): Promise<ReservationReceipt> {
    if (hours < 1 || hours > 24) {
      throw new ParkingError('invalid', 'Reservations last between 1 and 24 hours');
    }
    for (const spot of (await this.spots.all()).filter((s) => !electric || s.electric)) {
      const taken = (await this.reservations.forSpot(spot.code)).some((r) => r.clashesWith(from, hours));
      if (taken) continue;
      this.issued += 1;
      const reservation = new Reservation(`res-${this.issued}`, spot.code, plate, from, hours);
      const priceCents = spot.priceFor(hours);
      if (!(await this.payments.authorise(reservation.id, priceCents))) throw new ParkingError('invalid', 'Payment declined');
      await this.reservations.save(reservation);
      return { reservationId: reservation.id, spot: spot.code, priceCents };
    }
    throw new ParkingError('unavailable', 'No spot is free for that period');
  }
}
