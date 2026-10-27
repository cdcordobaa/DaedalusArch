import { createCarParks } from './carparks';
import type { BaysHeld } from './carparks/domain/carpark/events/BaysHeld';
import type { BaysRefused } from './carparks/domain/carpark/events/BaysRefused';
import { InMemoryCarParkRepository } from './carparks/infrastructure/InMemoryCarParkRepository';
import { EventRelay } from './messaging/EventRelay';
import { CarParksDirectory } from './reservations/acl/CarParksDirectory';
import { NotifyAttendant } from './reservations/application/NotifyAttendant';
import { createReservations } from './reservations';
import type { ReservationCancelled } from './reservations/domain/reservation/events/ReservationCancelled';
import type { ReservationRequested } from './reservations/domain/reservation/events/ReservationRequested';
import { InMemoryAttendantNotices } from './reservations/infrastructure/InMemoryAttendantNotices';
import { InMemoryReservationRepository } from './reservations/infrastructure/InMemoryReservationRepository';

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp() {
  const carParkStore = new InMemoryCarParkRepository();
  const reservationStore = new InMemoryReservationRepository();
  const notices = new InMemoryAttendantNotices();
  const carParks = createCarParks(carParkStore);
  const reservations = createReservations(reservationStore, new CarParksDirectory(carParks));
  const relay = new EventRelay([carParkStore, reservationStore]);
  const notifyAttendant = new NotifyAttendant(notices);
  relay.on('ReservationRequested', (e) => notifyAttendant.handle(e));
  relay.on('ReservationRequested', (e) => {
    const requested = e as ReservationRequested;
    carParks.reservationRequested(requested.reservationId, requested.carParkId, requested.bays);
  });
  relay.on('BaysHeld', (e) => reservations.baysHeld((e as BaysHeld).reservationId));
  relay.on('BaysRefused', (e) => reservations.baysRefused((e as BaysRefused).reservationId));
  relay.on('ReservationCancelled', (e) => {
    const cancelled = e as ReservationCancelled;
    carParks.reservationCancelled(cancelled.reservationId, cancelled.carParkId);
  });
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    openCarPark: (name: string, bays: number): string => command(() => carParks.open(name, bays)),
    carPark: (carParkId: string) => carParks.carPark(carParkId),
    blockBays: (carParkId: string, company: string, bays: number): void => command(() => carParks.holdBays(carParkId, company, bays)),
    releaseBlock: (carParkId: string, company: string): void => command(() => carParks.releaseBays(carParkId, company)),
    reserve: (driver: string, carParkId: string, bays: number): string => command(() => reservations.reserve(driver, carParkId, bays)),
    reservation: (reservationId: string) => reservations.reservation(reservationId),
    attendantNotices: (): string[] => notices.all(),
    cancelReservation: (reservationId: string): void => command(() => reservations.cancel(reservationId)),
    closeCarPark: (carParkId: string): void => command(() => carParks.close(carParkId)),
  };
}
