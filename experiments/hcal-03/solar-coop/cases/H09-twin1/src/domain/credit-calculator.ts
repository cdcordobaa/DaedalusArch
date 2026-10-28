import { TOTAL_SHARES } from './array-capacity';
import { Money } from './money';

export const RATE_CENTS_PER_KWH = 12;

export class CreditCalculator {
  static kwhShareFor(shares: number, producedKwh: number): number {
    return (producedKwh * shares) / TOTAL_SHARES;
  }
  static creditFor(shares: number, producedKwh: number, rateCentsPerKwh: number = RATE_CENTS_PER_KWH): Money {
    return Money.ofCents((shares / TOTAL_SHARES) * producedKwh * rateCentsPerKwh);
  }
}
