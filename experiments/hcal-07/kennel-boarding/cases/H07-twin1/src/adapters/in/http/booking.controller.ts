import { ConfirmBookingPort } from '../../../application/ports/in/confirm-booking.port';
import { BookingNotFoundError, DepositRefusedError } from '../../../domain/errors';
import { ConfirmBookingParamsDto, ConfirmBookingResponseDto, HttpReply } from './booking.dto';

const STATUS_BY_CODE: Record<string, number> = { BOOKING_NOT_FOUND: 404, DEPOSIT_REFUSED: 402 };

export class BookingController {
  constructor(private readonly confirmBooking: ConfirmBookingPort) {}

  async postConfirm(params: ConfirmBookingParamsDto): Promise<HttpReply<ConfirmBookingResponseDto>> {
    try {
      const result = await this.confirmBooking.confirm({ bookingId: params.bookingId });
      return { status: 200, body: { bookingId: result.bookingId, status: result.status } };
    } catch (e) {
      if (e instanceof BookingNotFoundError || e instanceof DepositRefusedError) {
        return { status: STATUS_BY_CODE[e.code], body: { bookingId: params.bookingId, status: 'REQUESTED', error: e.message } };
      }
      throw e;
    }
  }
}
