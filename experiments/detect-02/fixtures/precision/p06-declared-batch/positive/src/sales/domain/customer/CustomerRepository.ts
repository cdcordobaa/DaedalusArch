import type { Customer } from './Customer';

export interface CustomerRepository {
  byId(id: string): Promise<Customer | undefined>;
  save(customer: Customer): Promise<void>;
  saveAll(customers: readonly Customer[]): Promise<void>;
}
