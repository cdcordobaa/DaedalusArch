import { Money } from '../value-objects/Money';

// clean (service-stateless): state is set once, in the constructor.
export class DiscountService {
  private readonly rate: number;
  constructor(rate: number) {
    this.rate = rate;
  }
  apply(base: Money): Money {
    return new Money(Math.round(base.cents * (1 - this.rate)));
  }
}
