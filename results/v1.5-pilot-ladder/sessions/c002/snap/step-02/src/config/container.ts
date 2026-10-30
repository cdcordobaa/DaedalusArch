import { TillpayClient } from 'tillpay-sdk';
import { BookingController } from '../adapters/inbound/http/BookingController';
import { InMemoryBookings } from '../adapters/outbound/memory/InMemoryBookings';
import { TillpayRefundsAdapter } from '../adapters/outbound/tillpay/TillpayRefundsAdapter';
import { TillpayPaymentRecordsAdapter } from '../adapters/outbound/tillpay/TillpayPaymentRecordsAdapter';
import { TillpayPaymentCapturesAdapter } from '../adapters/outbound/tillpay/TillpayPaymentCapturesAdapter';
import { BookPitchService } from '../application/services/BookPitchService';
import { RefundDepositService } from '../application/services/RefundDepositService';
import { ReceiptService } from '../application/services/ReceiptService';

/** Composition root. The Tillpay key comes from TILLPAY_API_KEY. */
export function createApp() {
  const tillpay = new TillpayClient({ apiKey: process.env.TILLPAY_API_KEY ?? '' });
  const bookings = new InMemoryBookings();
  const records = new TillpayPaymentRecordsAdapter(tillpay);
  const stays = new BookPitchService(bookings, records, new TillpayPaymentCapturesAdapter(tillpay));
  const refunds = new RefundDepositService(new TillpayRefundsAdapter(tillpay));
  const http = new BookingController(stays, refunds, new ReceiptService(records));
  return {
    book: async (bookingId: string, pitch: string, nights: number, paymentId: string) => (await http.postBooking({ bookingId, pitch, nights, paymentId })).body,
    checkIn: async (bookingId: string) => (await http.postCheckIn(bookingId)).body,
    cancel: async (bookingId: string) => (await http.postCancel(bookingId)).body,
    refundDeposit: async (paymentId: string, amount: number) => (await http.postRefund({ paymentId, amount })).body,
    receipt: async (paymentId: string) => (await http.getReceipt(paymentId)).body,
    http,
  };
}
