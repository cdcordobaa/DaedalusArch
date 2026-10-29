import { TillpayClient } from 'tillpay-sdk';
import { BookingController } from '../adapters/inbound/http/BookingController';
import { InMemoryBookings } from '../adapters/outbound/memory/InMemoryBookings';
import { TillpayRefundsAdapter } from '../adapters/outbound/tillpay/TillpayRefundsAdapter';
import { TillpayCardPaymentsAdapter } from '../adapters/outbound/tillpay/TillpayCardPaymentsAdapter';
import { BookPitchService } from '../application/services/BookPitchService';
import { RefundDepositService } from '../application/services/RefundDepositService';

/** Composition root. The Tillpay key comes from TILLPAY_API_KEY. */
export function createApp() {
  const tillpay = new TillpayClient({ apiKey: process.env.TILLPAY_API_KEY ?? '' });
  const bookings = new InMemoryBookings();
  const stays = new BookPitchService(bookings, new TillpayCardPaymentsAdapter(tillpay));
  const refunds = new RefundDepositService(new TillpayRefundsAdapter(tillpay));
  const http = new BookingController(stays, refunds);
  return {
    book: async (bookingId: string, pitch: string, nights: number, paymentId: string) => (await http.postBooking({ bookingId, pitch, nights, paymentId })).body,
    checkIn: async (bookingId: string) => (await http.postCheckIn(bookingId)).body,
    cancel: async (bookingId: string) => (await http.postCancel(bookingId)).body,
    refundDeposit: async (paymentId: string, amount: number) => (await http.postRefund({ paymentId, amount })).body,
    http,
  };
}
