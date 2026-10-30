import { BookingController } from './adapters/in/http/booking.controller';
import { CheckInKiosk } from './adapters/in/kiosk/check-in.kiosk';
import { SmsOwnerNotifier } from './adapters/out/notification/sms-owner-notifier';
import { FurPayDepositGateway } from './adapters/out/payments/furpay-deposit.gateway';
import { InMemoryBookingRepository } from './adapters/out/persistence/in-memory-booking.repository';
import { CheckInUseCase } from './application/check-in.use-case';
import { ConfirmBookingUseCase } from './application/confirm-booking.use-case';

const bookings = new InMemoryBookingRepository();
const notifier = new SmsOwnerNotifier();
const confirmBooking = new ConfirmBookingUseCase(bookings, new FurPayDepositGateway('demo-key'), notifier);
const checkIn = new CheckInUseCase(bookings, notifier);

export const bookingController = new BookingController(confirmBooking);
export const checkInKiosk = new CheckInKiosk(checkIn);
