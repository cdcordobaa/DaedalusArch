import { ImportCustomers } from './sales/application/ImportCustomers';
import { InMemoryCustomerRepository } from './sales/infrastructure/InMemoryCustomerRepository';

export function createApp() {
  return { importCustomers: new ImportCustomers(new InMemoryCustomerRepository()) };
}
