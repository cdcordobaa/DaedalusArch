import type { CustomerRef } from '../../../shared-kernel/CustomerRef';
import type { Order } from './Order';

export interface OrderQueries {
  openFor(customer: CustomerRef): Promise<readonly Order[]>;
}
