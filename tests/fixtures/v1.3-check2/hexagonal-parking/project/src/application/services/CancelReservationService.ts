import { ParkingError } from '../../domain/errors/ParkingError';
import { CancelReservation } from '../ports/in/CancelReservation';
import { PaymentPort } from '../ports/out/PaymentPort';
import { ReservationRepository } from '../ports/out/ReservationRepository';

export class CancelReservationService implements CancelReservation {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly payments: PaymentPort,
  ) {}

  async cancel(reservationId: string): Promise<void> {
    const reservation = await this.reservations.byId(reservationId);
    if (reservation === undefined) throw new ParkingError('not-found', `No reservation ${reservationId}`);
    reservation.cancel(new Date());
    await this.reservations.save(reservation);
    await this.payments.refund(reservation.id);
  }
}
