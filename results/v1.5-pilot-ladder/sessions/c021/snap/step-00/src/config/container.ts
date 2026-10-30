import { TracklineClient } from 'trackline-sdk';
import { OrderController } from '../adapters/inbound/http/OrderController';
import { InMemoryOrders } from '../adapters/outbound/memory/InMemoryOrders';
import { TracklineCouriersAdapter } from '../adapters/outbound/trackline/TracklineCouriersAdapter';
import { TracklineTrackingAdapter } from '../adapters/outbound/trackline/TracklineTrackingAdapter';
import { BouquetOrderService } from '../application/services/orders/BouquetOrderService';
import { StaffNoteService } from '../application/services/admin/StaffNoteService';
import { InMemoryStaffNoteStore } from '../adapters/outbound/memory/admin/InMemoryStaffNoteStore';
import { FlowerDeliveryService } from '../application/services/admin/FlowerDeliveryService';
import { InMemoryFlowerDeliveryStore } from '../adapters/outbound/memory/admin/InMemoryFlowerDeliveryStore';
import { VaseLoanService } from '../application/services/admin/VaseLoanService';
import { InMemoryVaseLoanStore } from '../adapters/outbound/memory/admin/InMemoryVaseLoanStore';
import { WorkshopBookingService } from '../application/services/admin/WorkshopBookingService';
import { InMemoryWorkshopBookingStore } from '../adapters/outbound/memory/admin/InMemoryWorkshopBookingStore';

/** Composition root. The Trackline key comes from TRACKLINE_API_KEY. */
export function createApp() {
  const trackline = new TracklineClient({ apiKey: process.env.TRACKLINE_API_KEY ?? '' });
  const orders = new BouquetOrderService(new InMemoryOrders(), new TracklineCouriersAdapter(trackline), new TracklineTrackingAdapter(trackline));
  const http = new OrderController(orders);
  const staffNote = new StaffNoteService(new InMemoryStaffNoteStore());
  const flowerDelivery = new FlowerDeliveryService(new InMemoryFlowerDeliveryStore());
  const vaseLoan = new VaseLoanService(new InMemoryVaseLoanStore());
  const workshopBooking = new WorkshopBookingService(new InMemoryWorkshopBookingStore());
  return {
    placeOrder: async (body: Record<string, unknown>) => (await http.postOrder(body)).body,
    send: async (orderId: string) => (await http.postSend(orderId)).body,
    orderStatus: async (orderId: string) => (await http.getStatus(orderId)).body,
    changeMessage: async (orderId: string, message: string) => (await http.putMessage(orderId, message)).body,
    lastSeen: async (orderId: string) => (await http.getLastSeen(orderId)).body,
    admin: { staffNote, flowerDelivery, vaseLoan, workshopBooking },
    http,
  };
}
