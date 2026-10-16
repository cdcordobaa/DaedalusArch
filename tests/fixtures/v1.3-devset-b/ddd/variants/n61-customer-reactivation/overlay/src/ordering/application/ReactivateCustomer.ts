import type { CustomerRepository } from '../domain/customer/CustomerRepository.js';
import { CustomerId } from '../domain/customer/value-objects/CustomerId.js';

export class ReactivateCustomer {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(customerId: string): Promise<void> {
    const customer = await this.customers.byId(new CustomerId(customerId));
    if (customer === null) throw new Error('Unknown customer');
    customer.reactivate();
    await this.customers.save(customer);
  }
}
