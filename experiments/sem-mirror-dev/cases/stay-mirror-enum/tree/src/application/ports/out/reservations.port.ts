import { Stay } from '../../../domain/stay';

export interface ReservationsPort {
  stay(reservationId: string): Promise<Stay>;
}
