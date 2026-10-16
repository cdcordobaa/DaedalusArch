import { OrderRepo } from './internal/order-repo';
import type { OrderView } from './order.view';
export class OrderService {
  constructor(private readonly repo: OrderRepo) {}
  view(id: string): OrderView {
    return { id, total: this.repo.total(id) };
  }
}
