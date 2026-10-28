import { CancelReservation } from './application/CancelReservation';
import { GetReservation } from './application/GetReservation';
import { MarkCarParkClosed } from './application/MarkCarParkClosed';
import { RequestReservation } from './application/RequestReservation';
import type { CarParkDirectory } from './application/ports/CarParkDirectory';
import type { ReservationView } from './contracts/ReservationView';
import type { ReservationRepository } from './domain/reservation/ReservationRepository';

export type { ReservationView } from './contracts/ReservationView';

/** What the rest of the system may call. */
export interface ReservationsModule {
  reserve(driver: string, carParkId: string, bays: number): string;
  cancel(reservationId: string): void;
  carParkClosed(carParkId: string): void;
  reservation(reservationId: string): ReservationView | undefined;
}

export function createReservations(reservations: ReservationRepository, carParks: CarParkDirectory): ReservationsModule {
  return {
    reserve: (driver, carParkId, bays) => new RequestReservation(reservations, carParks).execute(driver, carParkId, bays),
    cancel: (reservationId) => new CancelReservation(reservations, carParks).execute(reservationId),
    carParkClosed: (carParkId) => new MarkCarParkClosed(reservations).execute(carParkId),
    reservation: (reservationId) => new GetReservation(reservations).execute(reservationId),
  };
}
