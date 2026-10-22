import { LegacyCreditCheck } from './sales/acl/LegacyCreditCheck';
import { PlaceOrderOnCredit } from './sales/application/PlaceOrderOnCredit';
import { InMemoryCustomerRepository } from './sales/infrastructure/InMemoryCustomerRepository';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';

export function createApp() {
  const customers = new InMemoryCustomerRepository();
  return { place: new PlaceOrderOnCredit(customers, new InMemoryOrderRepository(), new LegacyCreditCheck()) };
}
