import type { OrderRepository } from './order-repository';

export interface Order {
  readonly id: string;
}

export function saveOrder(o: Order, repo: OrderRepository): void {
  repo.save(o);
}
