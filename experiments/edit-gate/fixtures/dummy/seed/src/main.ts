import { SettleInvoices } from './billing/application/SettleInvoices';
import { InMemoryInvoiceRepository } from './billing/infrastructure/InMemoryInvoiceRepository';
import { PlaceOrder } from './sales/application/PlaceOrder';
import { InMemoryOrderQueries } from './sales/infrastructure/InMemoryOrderQueries';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';

export function createApp() {
  return { placeOrder: new PlaceOrder(new InMemoryOrderRepository(), new InMemoryOrderQueries()), settle: new SettleInvoices(new InMemoryInvoiceRepository()) };
}
