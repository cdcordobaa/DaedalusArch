import type { Order } from './Order.js';

/** Outbound port: declared in the core, implemented by an outbound adapter. */
export interface OrderRepository {
  save(order: Order): void;
}
