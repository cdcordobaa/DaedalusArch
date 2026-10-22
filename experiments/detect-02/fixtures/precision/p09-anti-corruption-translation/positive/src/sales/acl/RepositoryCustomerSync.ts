import type { CustomerSync } from '../application/ports/CustomerSync';
import type { Customer } from '../domain/customer/Customer';
import type { CustomerRepository } from '../domain/customer/CustomerRepository';

export class RepositoryCustomerSync implements CustomerSync {
  constructor(private readonly customers: CustomerRepository) {}

  async purchased(customer: Customer): Promise<void> {
    customer.recordPurchase();
    await this.customers.save(customer);
  }
}
