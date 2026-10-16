import type { FeeSchedule } from "../../application/ports/fee-schedule.js";
import type { Money } from "../../domain/money.js";

/** Fees from configuration: base fee in cents per specialty, one currency. */
export class StaticFeeSchedule implements FeeSchedule {
  constructor(
    private readonly centsBySpecialty: Readonly<Record<string, number>>,
    private readonly currency: string,
  ) {}

  baseFeeFor(specialty: string): Money | undefined {
    const cents = Object.hasOwn(this.centsBySpecialty, specialty) ? this.centsBySpecialty[specialty] : undefined;
    return cents === undefined ? undefined : { cents, currency: this.currency };
  }
}
