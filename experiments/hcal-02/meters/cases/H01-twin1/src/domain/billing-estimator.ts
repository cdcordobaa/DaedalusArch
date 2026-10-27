import { InvalidReadingError } from "./errors";
import { Kwh } from "./kwh";
import { Meter } from "./meter";
import { Money } from "./money";
import { Tariff } from "./tariff";

export const HIGH_USAGE_KWH = 900;

export type UsageLevel = "normal" | "high";

export interface BillEstimate {
  readonly projected: Kwh;
  readonly cost: Money;
  readonly level: UsageLevel;
}

export interface UsageSummary {
  readonly projectedKwh: number;
  readonly cents: number;
  readonly level: UsageLevel;
}

export class BillingEstimator {
  estimate(meter: Meter, tariff: Tariff, days: number): BillEstimate {
    const first = meter.first();
    const last = meter.latest();
    if (!first || !last) {
      throw new InvalidReadingError("at least one reading is required");
    }
    const spanDays = Math.max(1, (last.takenAt.getTime() - first.takenAt.getTime()) / 86_400_000);
    const used = last.kwh.minus(first.kwh);
    const projected = Kwh.of((used.value / spanDays) * days);
    return {
      projected,
      cost: tariff.costOf(projected),
      level: projected.value >= HIGH_USAGE_KWH ? "high" : "normal",
    };
  }

  summarize(estimate: BillEstimate): UsageSummary {
    return {
      projectedKwh: estimate.projected.value,
      cents: estimate.cost.cents,
      level: estimate.level,
    };
  }
}
