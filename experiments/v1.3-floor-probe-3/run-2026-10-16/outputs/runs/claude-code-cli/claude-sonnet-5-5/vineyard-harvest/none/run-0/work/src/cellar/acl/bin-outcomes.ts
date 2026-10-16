import type { CellarService } from "../application/cellar-service.js";

/** Published language of the cellar context, consumed by other contexts. */
export interface BinOutcomeView {
  status: "accepted" | "rejected" | "pending";
  grossKg?: number;
}

export class BinOutcomesFacade {
  constructor(private readonly cellar: CellarService) {}

  lookup(date: string, tag: number): BinOutcomeView {
    const d = this.cellar.findIntake(date, tag);
    if (!d) {
      const w = this.cellar.latestWeighing(tag);
      return w ? { status: "pending", grossKg: w.grossKg } : { status: "pending" };
    }
    return d.grossKg === undefined ? { status: d.status } : { status: d.status, grossKg: d.grossKg };
  }
}
