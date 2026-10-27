import { HaemalinkClient } from 'haemalink-sdk';
import { WardTerminal } from '../adapters/inbound/terminal/WardTerminal';
import { HaemalinkDeliveries } from '../adapters/outbound/haemalink/HaemalinkDeliveries';
import { HaemalinkSupplierOrders } from '../adapters/outbound/haemalink/HaemalinkSupplierOrders';
import { ShelfFridge, type ShelfLine } from '../adapters/outbound/memory/ShelfFridge';
import { FollowDelivery } from '../application/FollowDelivery';
import type { UnitRequestInput } from '../application/RequestUnits';
import { RequestUnitsService } from '../application/RequestUnitsService';

/** Composition root. The Haemalink key comes from HAEMALINK_API_KEY and our site code from HAEMALINK_SITE. */
export function createApp(options: { stock?: readonly ShelfLine[] } = {}) {
  const haemalink = new HaemalinkClient({ apiKey: process.env.HAEMALINK_API_KEY ?? '', siteCode: process.env.HAEMALINK_SITE ?? '' });
  const units = new RequestUnitsService(new ShelfFridge(options.stock), new HaemalinkSupplierOrders(haemalink));
  const deliveries = new FollowDelivery(new HaemalinkDeliveries(haemalink));
  const terminal = new WardTerminal(units, deliveries);
  return {
    request: (input: UnitRequestInput) => units.request(input),
    delivery: (orderNumber: string) => deliveries.latest(orderNumber),
    terminal,
  };
}
