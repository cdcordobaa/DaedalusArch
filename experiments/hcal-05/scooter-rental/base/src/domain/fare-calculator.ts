import { Money } from './money';

export class FareCalculator {
  private readonly unlockFee = new Money(100);
  private readonly perMinute = new Money(25);
  price(minutes: number): Money { return this.unlockFee.add(this.perMinute.times(minutes)); }
}
