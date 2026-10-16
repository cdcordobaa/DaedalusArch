import type { WeighWellSource } from "../domain/ports.js";
import type { CellarService } from "./cellar-service.js";

/** Pulls new WeighWell weighings and feeds them into the cellar like any other weighing. */
export class WeighWellSync {
  private cursor: string | undefined;

  constructor(
    private readonly source: WeighWellSource,
    private readonly cellar: CellarService,
  ) {}

  /** Returns the number of weighings received. Duplicates are ignored by the cellar. */
  async poll(): Promise<number> {
    const batch = await this.source.fetchNew(this.cursor);
    for (const w of batch.weighings) this.cellar.recordChipWeighing(w);
    this.cursor = batch.cursor;
    return batch.weighings.length;
  }
}
