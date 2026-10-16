import type { Customer } from '../domain/customer/Customer.js';
import type { CustomerRepository } from '../domain/customer/CustomerRepository.js';
import type { CustomerId } from '../domain/customer/value-objects/CustomerId.js';

export class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly rows: ReadonlyMap<string, Customer>) {}

  async byId(id: CustomerId): Promise<Customer | null> {
    return this.rows.get(id.value) ?? null;
  }
}
