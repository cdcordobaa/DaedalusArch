import { Customer } from '../model/Customer';
import { Money } from '../model/Money';

/** Gold customers get 10 % off orders of 100 EUR or more. */
export class PricingPolicy {
  discountFor(customer: Customer, subtotal: Money): Money {
    return customer.isGold && subtotal.cents >= 10_000 ? subtotal.percent(10) : Money.zero();
  }
}
