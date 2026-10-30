import { ConfirmBookingPort } from '../../../application/ports/in/confirm-booking.port';
import { BookingNotFoundError, FurPayDecline } from '../../../domain/errors';
import { ConfirmBookingParamsDto, ConfirmBookingResponseDto, HttpReply } from './booking.dto';

export class BookingController {
  constructor(private readonly confirmBooking: ConfirmBookingPort) {}

  async postConfirm(params: ConfirmBookingParamsDto): Promise<HttpReply<ConfirmBookingResponseDto>> {
    try {
      const result = await this.confirmBooking.confirm({ bookingId: params.bookingId });
      return { status: 200, body: { bookingId: result.bookingId, status: result.status } };
    } catch (e) {
      if (e instanceof BookingNotFoundError) {
        return { status: 404, body: { bookingId: params.bookingId, status: 'UNKNOWN', error: e.message } };
      }
      if (e instanceof FurPayDecline) {
        return { status: 402, body: { bookingId: params.bookingId, status: 'REQUESTED', error: e.reason } };
      }
      throw e;
    }
  }
}
