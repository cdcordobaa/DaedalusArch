import { Money } from '../value-objects/Money';

// violating (service-stateless): remembers the last price across calls.
export class PricingService {
  private lastPrice: Money | undefined;
  price(base: Money): Money {
    this.lastPrice = base.add(new Money(100));
    return this.lastPrice;
  }
}
