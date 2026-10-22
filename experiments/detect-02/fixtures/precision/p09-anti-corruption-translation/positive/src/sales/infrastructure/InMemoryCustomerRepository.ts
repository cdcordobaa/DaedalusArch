import type { Customer } from '../domain/customer/Customer';
import type { CustomerRepository } from '../domain/customer/CustomerRepository';

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly rows = new Map<string, Customer>();

  async byId(id: string): Promise<Customer | undefined> {
    return this.rows.get(id);
  }

  async save(customer: Customer): Promise<void> {
    this.rows.set(customer.id, customer);
  }

  async saveAll(customers: readonly Customer[]): Promise<void> {
    for (const c of customers) this.rows.set(c.id, c);
  }
}
