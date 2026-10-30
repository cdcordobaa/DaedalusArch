import { BookingStatus } from '../../../domain/booking-status';

export interface ConfirmBookingCommand {
  readonly bookingId: string;
}

export interface ConfirmBookingResult {
  readonly bookingId: string;
  readonly status: BookingStatus;
  readonly auditRow: string;
}

export interface ConfirmBookingPort {
  confirm(command: ConfirmBookingCommand): Promise<ConfirmBookingResult>;
}
