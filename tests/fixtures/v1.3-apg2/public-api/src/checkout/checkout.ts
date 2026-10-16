// PA1: deep import into a declared public API (orders/internal is not in it).
import { OrderRepo } from '../orders/internal/order-repo';
// NM-PA1: import through the public barrel.
import { OrderService } from '../orders';
// PA2: deep import into an inferred public API (payments/index.ts exists; gateway/stripe is behind it).
import { StripeGateway } from '../payments/gateway/stripe';
export class Checkout {
  repo = new OrderRepo();
  orders = new OrderService(this.repo);
  gateway = new StripeGateway();
}
