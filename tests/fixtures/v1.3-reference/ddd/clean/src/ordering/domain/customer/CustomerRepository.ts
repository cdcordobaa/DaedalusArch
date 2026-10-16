import type { Customer } from './Customer.js';
import type { CustomerId } from './value-objects/CustomerId.js';

export interface CustomerRepository {
  byId(id: CustomerId): Promise<Customer | null>;
}
