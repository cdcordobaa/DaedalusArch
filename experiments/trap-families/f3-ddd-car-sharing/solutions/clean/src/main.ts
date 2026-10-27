import { AddCar } from './fleet/application/AddCar';
import { BookCar } from './fleet/application/BookCar';
import { CancelBooking } from './fleet/application/CancelBooking';
import { EventRelay } from './fleet/application/EventRelay';
import { GetBookings, type BookingLine } from './fleet/application/GetBookings';
import { GetLog, type LogLine } from './fleet/application/GetLog';
import { MoveBooking } from './fleet/application/MoveBooking';
import { ReleaseMovedBooking } from './fleet/application/ReleaseMovedBooking';
import { SendAvailabilityNotice } from './fleet/application/SendAvailabilityNotice';
import { InMemoryCarRepository } from './fleet/infrastructure/InMemoryCarRepository';
import { InMemoryNotices } from './fleet/infrastructure/InMemoryNotices';

export interface AppOptions {
  /** Today's date as YYYY-MM-DD; defaults to the system date. */
  readonly today?: () => string;
}

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp(options: AppOptions = {}) {
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const cars = new InMemoryCarRepository();
  const notices = new InMemoryNotices();
  const relay = new EventRelay(cars);
  const availability = new SendAvailabilityNotice(notices);
  relay.on('CarAdded', (e) => availability.handle(e));
  const release = new ReleaseMovedBooking(cars);
  relay.on('BookingMoved', (e) => release.handle(e));
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    addCar: (plate: string, zone: string): string => command(() => new AddCar(cars).execute(plate, zone)),
    book: (carId: string, memberId: string, start: string, end: string): string =>
      command(() => new BookCar(cars).execute(carId, memberId, start, end)),
    cancel: (carId: string, bookingId: string): void => command(() => new CancelBooking(cars).execute(carId, bookingId)),
    moveBooking: (bookingId: string, fromCarId: string, toCarId: string): string =>
      command(() => new MoveBooking(cars).execute(bookingId, fromCarId, toCarId)),
    logOf: (carId: string): LogLine[] => new GetLog(cars).execute(carId),
    bookingsOf: (carId: string): BookingLine[] => new GetBookings(cars).execute(carId),
    notices: (): string[] => notices.all(),
  };
}
