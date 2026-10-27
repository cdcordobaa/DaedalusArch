import { createCarParks } from './carparks';
import { InMemoryCarParkRepository } from './carparks/infrastructure/InMemoryCarParkRepository';
import { EventRelay } from './messaging/EventRelay';
import { CarParksDirectory } from './reservations/acl/CarParksDirectory';
import { NotifyAttendant } from './reservations/application/NotifyAttendant';
import { createReservations } from './reservations';
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
