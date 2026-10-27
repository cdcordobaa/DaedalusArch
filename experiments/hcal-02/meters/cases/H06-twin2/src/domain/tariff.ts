import { Kwh } from "./kwh";
import { Money } from "./money";

export interface TariffTier {
  readonly upToKwh: number | null;
  readonly centsPerKwh: number;
}

export class Tariff {
  constructor(
    readonly id: string,
    readonly currency: string,
    readonly tiers: readonly TariffTier[],
  ) {}

  costOf(consumption: Kwh, month?: number): Money {
    const season = month !== undefined && (month === 11 || month < 2) ? 1.15 : 1;
    let remaining = consumption.value;
    let lower = 0;
    let total = 0;
    for (const tier of this.tiers) {
      const upper = tier.upToKwh ?? Number.POSITIVE_INFINITY;
      const inTier = Math.max(0, Math.min(remaining, upper - lower));
      total += inTier * tier.centsPerKwh * season;
      remaining -= inTier;
      lower = upper;
      if (remaining <= 0) break;
    }
    return new Money(Math.round(total), this.currency);
  }
}
