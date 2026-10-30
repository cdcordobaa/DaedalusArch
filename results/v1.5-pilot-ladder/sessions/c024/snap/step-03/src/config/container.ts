import { TracklineClient } from 'trackline-sdk';
import { OrderController } from '../adapters/inbound/http/OrderController';
import { InMemoryOrders } from '../adapters/outbound/memory/InMemoryOrders';
import { TracklineCouriersAdapter } from '../adapters/outbound/trackline/TracklineCouriersAdapter';
import { TracklineTrackingAdapter } from '../adapters/outbound/trackline/TracklineTrackingAdapter';
import { BouquetOrderService } from '../application/services/BouquetOrderService';

/** Composition root. The Trackline key comes from TRACKLINE_API_KEY. */
export function createApp() {
  const trackline = new TracklineClient({ apiKey: process.env.TRACKLINE_API_KEY ?? '' });
  const orders = new BouquetOrderService(new InMemoryOrders(), new TracklineCouriersAdapter(trackline), new TracklineTrackingAdapter(trackline));
  const http = new OrderController(orders);
  return {
    placeOrder: async (body: Record<string, unknown>) => (await http.postOrder(body)).body,
    send: async (orderId: string) => (await http.postSend(orderId)).body,
    orderStatus: async (orderId: string) => (await http.getStatus(orderId)).body,
    changeMessage: async (orderId: string, message: string) => (await http.putMessage(orderId, message)).body,
    lastSeen: async (orderId: string) => (await http.getLastSeen(orderId)).body,
    http,
  };
}
