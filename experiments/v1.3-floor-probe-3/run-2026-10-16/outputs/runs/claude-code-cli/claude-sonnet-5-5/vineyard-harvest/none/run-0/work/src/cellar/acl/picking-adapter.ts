import type { PickedBinsFacade } from "../../picking/acl/published-bins.js";
import type { PickedBin } from "../domain/bin-intake.js";
import type { PickedBinLookup } from "../domain/ports.js";

/** Translates picking's published language into the cellar's own model. */
export class PickingAdapter implements PickedBinLookup {
  constructor(private readonly picking: PickedBinsFacade) {}

  find(date: string, tag: number): PickedBin | undefined {
    const v = this.picking.lookup(date, tag);
    return v ? { tag: v.tag, date: v.date, grapeVariety: v.grapeVariety } : undefined;
  }
}
