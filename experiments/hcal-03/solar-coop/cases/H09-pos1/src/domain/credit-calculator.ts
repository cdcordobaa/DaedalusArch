import { TOTAL_SHARES } from './array-capacity';
import { Money } from './money';

export const RATE_CENTS_PER_KWH = 12;

export class CreditCalculator {
  static kwhShareFor(shares: number, producedKwh: number): number {
    return (producedKwh * shares) / TOTAL_SHARES;
  }
  static creditFor(shares: number, producedKwh: number): Money {
    const rate = Number(process.env.COOP_RATE_CENTS ?? RATE_CENTS_PER_KWH);
    return Money.ofCents((shares / TOTAL_SHARES) * producedKwh * rate);
  }
}
