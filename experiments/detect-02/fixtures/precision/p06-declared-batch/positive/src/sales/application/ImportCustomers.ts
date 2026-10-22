import { Customer } from '../domain/customer/Customer';
import type { CustomerRepository } from '../domain/customer/CustomerRepository';

export interface CustomerRow {
  readonly id: string;
  readonly name: string;
}

/** Nightly import of a partner file: every row becomes a new customer, all or nothing. */
export class ImportCustomers {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(rows: readonly CustomerRow[]): Promise<number> {
    const created = rows.map((r) => Customer.register(r.id, r.name));
    await this.customers.saveAll(created);
    return created.length;
  }
}
