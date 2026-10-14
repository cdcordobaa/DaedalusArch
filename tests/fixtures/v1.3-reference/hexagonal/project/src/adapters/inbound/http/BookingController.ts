import { BookRoom } from '../../../application/ports/in/BookRoom';
import { CancelBooking } from '../../../application/ports/in/CancelBooking';
import { BookingError } from '../../../domain/errors/BookingError';
import { HttpRequest, HttpResponse } from './HttpTypes';

const STATUS = { 'not-found': 404, unavailable: 409, invalid: 400, 'payment-declined': 402 } as const;

/** Driving adapter: translates HTTP into calls on the application's driving ports. */
export class BookingController {
  constructor(
    private readonly bookRoom: BookRoom,
    private readonly cancelBooking: CancelBooking,
  ) {}

  async create(request: HttpRequest): Promise<HttpResponse> {
    try {
      const view = await this.bookRoom.book({
        roomId: String(request.body['roomId']),
        guestId: String(request.body['guestId']),
        checkIn: String(request.body['checkIn']),
        checkOut: String(request.body['checkOut']),
        guests: Number(request.body['guests'] ?? 1),
      });
      return { status: 201, body: view };
    } catch (error) {
      return this.toResponse(error);
    }
  }

  async cancel(request: HttpRequest): Promise<HttpResponse> {
    try {
      return { status: 200, body: await this.cancelBooking.cancel(String(request.params['id'])) };
    } catch (error) {
      return this.toResponse(error);
    }
  }

  private toResponse(error: unknown): HttpResponse {
    if (error instanceof BookingError) return { status: STATUS[error.reason], body: { error: error.message } };
    return { status: 500, body: { error: 'Internal error' } };
  }
}
