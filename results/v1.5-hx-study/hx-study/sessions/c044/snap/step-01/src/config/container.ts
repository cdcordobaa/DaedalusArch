import { SacklineClient } from 'sackline-sdk';
import { BuyerController } from '../adapters/inbound/http/BuyerController';
import { InMemoryFlourOrders } from '../adapters/outbound/memory/InMemoryFlourOrders';
import { SacklineSupplierAdapter } from '../adapters/outbound/sackline/SacklineSupplierAdapter';
import { OrderFlourService } from '../application/services/OrderFlourService';

/** Composition root. The Sackline token comes from SACKLINE_TOKEN; our account there is BAKERY-17. The returned object is the app. */
export function createApp() {
  const sackline = new SacklineClient({ token: process.env.SACKLINE_TOKEN ?? '', account: 'BAKERY-17' });
  const http = new BuyerController(new OrderFlourService(new SacklineSupplierAdapter(sackline), new InMemoryFlourOrders()));
  return {
    flours: async () => (await http.getFlours()).body,
    order: async (orderId: string, sku: string, bags: number, deliverOn: string) => (await http.postOrder({ orderId, sku, bags, deliverOn })).body,
    http,
  };
}
