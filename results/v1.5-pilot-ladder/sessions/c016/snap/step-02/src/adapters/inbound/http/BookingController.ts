import type { BookPitch } from '../../../application/ports/in/BookPitch';
import type { RefundDeposit } from '../../../application/ports/in/RefundDeposit';
import type { PaymentReceipt } from '../../../application/ports/in/PaymentReceipt';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST /bookings, POST /bookings/:id/check-in, POST /bookings/:id/cancel, POST /refunds, GET /receipts/:paymentId. */
export class BookingController {
  constructor(
    private readonly bookings: BookPitch,
    private readonly refunds: RefundDeposit,
    private readonly receipts: PaymentReceipt,
  ) {}

  postBooking(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.bookings.book({ bookingId: String(body.bookingId ?? ''), pitch: String(body.pitch ?? ''), nights: Number(body.nights), paymentId: String(body.paymentId ?? '') }));
  }

  postCheckIn(bookingId: string): Promise<HttpResponse> {
    return this.run(() => this.bookings.checkIn(bookingId));
  }

  postCancel(bookingId: string): Promise<HttpResponse> {
    return this.run(() => this.bookings.cancel(bookingId));
  }

  postRefund(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.refunds.refund(String(body.paymentId ?? ''), Number(body.amount)));
  }

  getReceipt(paymentId: string): Promise<HttpResponse> {
    return this.run(() => this.receipts.receipt(paymentId));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
