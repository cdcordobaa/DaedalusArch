import { BookingController } from './adapters/in/http/booking.controller';
import { IceTrailBulletinHandler } from './adapters/in/webhook/icetrail-bulletin.handler';
import { ConsoleClientNotifier, IceTrailPermitGateway, InMemoryBookingRepository } from './adapters/out';
import { BookTourUseCase } from './application/book-tour.use-case';
import { RecordConditionsUseCase } from './application/record-conditions.use-case';

const bookings = new InMemoryBookingRepository();
const notifier = new ConsoleClientNotifier();
const bookTour = new BookTourUseCase(bookings, new IceTrailPermitGateway('demo-key'), notifier);
const recordConditions = new RecordConditionsUseCase(bookings, notifier);

export const bookingController = new BookingController(bookTour);
export const iceTrailBulletins = new IceTrailBulletinHandler(recordConditions);
