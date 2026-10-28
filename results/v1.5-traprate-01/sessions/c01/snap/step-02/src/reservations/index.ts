import { CancelReservation } from './application/CancelReservation';
import { GetReservation } from './application/GetReservation';
import { RequestReservation } from './application/RequestReservation';
import type { CarParkDirectory } from './application/ports/CarParkDirectory';
import type { ReservationView } from './contracts/ReservationView';
import type { ReservationRepository } from './domain/reservation/ReservationRepository';

export type { ReservationView } from './contracts/ReservationView';

/** What the rest of the system may call. */
export interface ReservationsModule {
  reserve(driver: string, carParkId: string, bays: number): string;
  reservation(reservationId: string): ReservationView | undefined;
  cancel(reservationId: string): void;
}

export function createReservations(reservations: ReservationRepository, carParks: CarParkDirectory): ReservationsModule {
  return {
    reserve: (driver, carParkId, bays) => new RequestReservation(reservations, carParks).execute(driver, carParkId, bays),
    reservation: (reservationId) => new GetReservation(reservations).execute(reservationId),
    cancel: (reservationId) => new CancelReservation(reservations, carParks).execute(reservationId),
  };
}
