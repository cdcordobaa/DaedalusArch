import type { Money } from "../../domain/money.js";

export interface FeeSchedule {
  /** Base consultation fee for a specialty, or undefined if none is configured. */
  baseFeeFor(specialty: string): Money | undefined;
}
