import type { Customer } from '../../domain/customer/Customer';

/** Pushes the customer's purchase into the customer record. */
export interface CustomerSync {
  purchased(customer: Customer): Promise<void>;
}
