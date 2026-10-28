import type { Reservation } from './Reservation';
import type { ReservationId } from './value-objects/ReservationId';

export interface ReservationRepository {
  nextId(): ReservationId;
  byId(id: ReservationId): Reservation | undefined;
  byCarPark(carParkId: string): Reservation[];
  /** Stores the reservation and its pending events in one step. */
  save(reservation: Reservation): void;
}
