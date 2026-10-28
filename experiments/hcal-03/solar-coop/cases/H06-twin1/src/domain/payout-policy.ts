import { Money } from './money';

export class PayoutPolicy {
  static readonly MINIMUM_CENTS = 500;
  static isPayable(amount: Money): boolean {
    return amount.cents >= PayoutPolicy.MINIMUM_CENTS;
  }
}
