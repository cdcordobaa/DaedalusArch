import { ShippingPolicy } from '../domain/shipping-policy';
import type { CartLine } from '../domain/shipping-policy';

export interface CheckoutSummary {
  readonly lines: readonly CartLine[];
  readonly shipping: number;
}

export class CheckoutService {
  constructor(private readonly shipping: ShippingPolicy) {}

  summarise(lines: readonly CartLine[]): CheckoutSummary {
    return { lines, shipping: this.shipping.shippingFor(lines) };
  }
}
