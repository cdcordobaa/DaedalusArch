import type { PickingService } from "../application/picking-service.js";

/** Published language of the picking context, consumed by other contexts. */
export interface PickedBinView {
  tag: number;
  date: string;
  blockId: string;
  grapeVariety: string;
}

export class PickedBinsFacade {
  constructor(private readonly picking: PickingService) {}

  lookup(date: string, tag: number): PickedBinView | undefined {
    const bin = this.picking.findBin(date, tag);
    if (!bin) return undefined;
    const block = this.picking.findBlock(bin.blockId);
    if (!block) return undefined;
    return { tag, date, blockId: bin.blockId, grapeVariety: block.grapeVariety };
  }
}
