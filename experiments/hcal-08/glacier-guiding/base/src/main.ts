import { BookingController } from './adapters/in/http/booking.controller';
import { IceTrailBulletinHandler } from './adapters/in/webhook/icetrail-bulletin.handler';
import { ConsoleClientNotifier } from './adapters/out/notification/console-client-notifier';
import { InMemoryBookingRepository } from './adapters/out/persistence/in-memory-booking.repository';
import { IceTrailPermitGateway } from './adapters/out/permits/icetrail-permit.gateway';
import { BookTourUseCase } from './application/book-tour.use-case';
import { RecordConditionsUseCase } from './application/record-conditions.use-case';

const bookings = new InMemoryBookingRepository();
const notifier = new ConsoleClientNotifier();
const bookTour = new BookTourUseCase(bookings, new IceTrailPermitGateway('demo-key'), notifier);
const recordConditions = new RecordConditionsUseCase(bookings, notifier);

export const bookingController = new BookingController(bookTour);
export const iceTrailBulletins = new IceTrailBulletinHandler(recordConditions);
