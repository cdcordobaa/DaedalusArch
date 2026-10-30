import { TillpayClient } from 'tillpay-sdk';
import { BookingController } from '../adapters/inbound/http/BookingController';
import { InMemoryBookings } from '../adapters/outbound/memory/InMemoryBookings';
import { InMemoryPitches } from '../adapters/outbound/memory/InMemoryPitches';
import { TillpayRefundsAdapter } from '../adapters/outbound/tillpay/TillpayRefundsAdapter';
import { TillpayPaymentRecordsAdapter } from '../adapters/outbound/tillpay/TillpayPaymentRecordsAdapter';
import { BookPitchService } from '../application/services/stays/BookPitchService';
import { RefundDepositService } from '../application/services/stays/RefundDepositService';
import { ReceiptService } from '../application/services/stays/ReceiptService';
import { StaffNoteService } from '../application/services/admin/StaffNoteService';
import { InMemoryStaffNoteStore } from '../adapters/outbound/memory/admin/InMemoryStaffNoteStore';
import { FirewoodSaleService } from '../application/services/admin/FirewoodSaleService';
import { InMemoryFirewoodSaleStore } from '../adapters/outbound/memory/admin/InMemoryFirewoodSaleStore';
import { ToiletBlockCheckService } from '../application/services/admin/ToiletBlockCheckService';
import { InMemoryToiletBlockCheckStore } from '../adapters/outbound/memory/admin/InMemoryToiletBlockCheckStore';
import { LostItemService } from '../application/services/admin/LostItemService';
import { InMemoryLostItemStore } from '../adapters/outbound/memory/admin/InMemoryLostItemStore';

/** Composition root. The Tillpay key comes from TILLPAY_API_KEY. */
export function createApp() {
  const tillpay = new TillpayClient({ apiKey: process.env.TILLPAY_API_KEY ?? '' });
  const bookings = new InMemoryBookings();
  const records = new TillpayPaymentRecordsAdapter(tillpay);
  const stays = new BookPitchService(bookings, new InMemoryPitches(), records);
  const refunds = new RefundDepositService(new TillpayRefundsAdapter(tillpay));
  const http = new BookingController(stays, refunds, new ReceiptService(records));
  const staffNote = new StaffNoteService(new InMemoryStaffNoteStore());
  const firewoodSale = new FirewoodSaleService(new InMemoryFirewoodSaleStore());
  const toiletBlockCheck = new ToiletBlockCheckService(new InMemoryToiletBlockCheckStore());
  const lostItem = new LostItemService(new InMemoryLostItemStore());
  return {
    book: async (bookingId: string, pitch: string, nights: number, paymentId: string) => (await http.postBooking({ bookingId, pitch, nights, paymentId })).body,
    checkIn: async (bookingId: string) => (await http.postCheckIn(bookingId)).body,
    cancel: async (bookingId: string) => (await http.postCancel(bookingId)).body,
    refundDeposit: async (paymentId: string, amount: number) => (await http.postRefund({ paymentId, amount })).body,
    receipt: async (paymentId: string) => (await http.getReceipt(paymentId)).body,
    admin: { staffNote, firewoodSale, toiletBlockCheck, lostItem },
    http,
  };
}
