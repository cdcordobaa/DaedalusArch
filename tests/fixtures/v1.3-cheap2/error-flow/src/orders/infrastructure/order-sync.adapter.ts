import { Order } from '../domain/order';

export class OrderSyncAdapter {
  /** PLANTED P4: a catch-all without a binding swallows the domain error. */
  sync(order: Order): boolean {
    try {
      order.confirm();
      return true;
    } catch {
      return false;
    }
  }

  /** NEAR-MISS N5: the try block can throw nothing the project declares (JSON.parse). */
  parse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
