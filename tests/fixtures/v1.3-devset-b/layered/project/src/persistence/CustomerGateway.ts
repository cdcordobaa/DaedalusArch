import { InMemoryDatabase } from './Database';
import { CustomerRecord } from './records/CustomerRecord';

/** Table Data Gateway for the customers table. */
export class CustomerGateway {
  constructor(private readonly db: InMemoryDatabase) {}

  findById(id: string): CustomerRecord | undefined {
    return this.db.table<CustomerRecord>('customers').get(id);
  }

  insert(record: CustomerRecord): void {
    this.db.table<CustomerRecord>('customers').set(record.id, { ...record });
  }
}
