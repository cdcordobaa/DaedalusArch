import type { BinOutcomesFacade } from "../../cellar/acl/bin-outcomes.js";
import type { BinOutcome } from "../domain/pay.js";
import type { BinOutcomeLookup } from "../domain/repositories.js";

/** Translates the cellar's published language into picking's own model. */
export class CellarAdapter implements BinOutcomeLookup {
  constructor(private readonly cellar: BinOutcomesFacade) {}

  find(date: string, tag: number): BinOutcome {
    const v = this.cellar.lookup(date, tag);
    return v.grossKg === undefined ? { status: v.status } : { status: v.status, grossKg: v.grossKg };
  }
}
