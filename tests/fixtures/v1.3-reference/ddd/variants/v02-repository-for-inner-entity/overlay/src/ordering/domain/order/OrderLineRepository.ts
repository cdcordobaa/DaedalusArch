import type { OrderLine } from './OrderLine.js';

// VIOLATION (repositories only for aggregate roots): a repository for the inner entity OrderLine.
export interface OrderLineRepository {
  byProduct(productId: string): Promise<OrderLine[]>;
  save(line: OrderLine): Promise<void>;
}
