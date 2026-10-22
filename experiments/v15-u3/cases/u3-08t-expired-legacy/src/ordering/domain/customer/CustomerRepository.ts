import type { Customer } from './Customer';

export interface CustomerRepository {
  save(customer: Customer): void;
}
