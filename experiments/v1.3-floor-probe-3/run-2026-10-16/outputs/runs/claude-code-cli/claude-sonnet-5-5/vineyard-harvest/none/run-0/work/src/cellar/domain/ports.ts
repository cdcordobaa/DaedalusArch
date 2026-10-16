import type { ChipWeighing, IntakeDecision, PickedBin, Weighing } from "./bin-intake.js";

/** Cellar's view of picking, implemented by an anti-corruption adapter. */
export interface PickedBinLookup {
  find(date: string, tag: number): PickedBin | undefined;
}

export interface VarietyRules {
  minimumBrix(variety: string): number | undefined;
  setMinimumBrix(variety: string, brix: number): void;
  list(): Record<string, number>;
}

export interface WeighingRepository {
  save(w: Weighing): void;
  hasRef(source: string, ref: string): boolean;
  replaceForTag(w: Weighing): void;
  latest(tag: number): Weighing | undefined;
  list(): Weighing[];
}

export interface IntakeRepository {
  save(d: IntakeDecision): void;
  find(date: string, tag: number): IntakeDecision | undefined;
  list(): IntakeDecision[];
}

export interface RfidLinkRepository {
  link(chip: string, tag: number): void;
  find(chip: string): number | undefined;
  list(): Record<string, number>;
}

/** Chip weighings waiting for staff to link their chip to a bin tag. */
export interface UnlinkedWeighingRepository {
  add(w: ChipWeighing): void;
  has(source: string, ref: string): boolean;
  takeForChip(chip: string): ChipWeighing[];
  list(): ChipWeighing[];
}

export interface WeighingBatch {
  weighings: ChipWeighing[];
  cursor: string | undefined;
}

/** Cellar's view of the WeighWell weighbridge, implemented by an anti-corruption client. */
export interface WeighWellSource {
  fetchNew(cursor: string | undefined): Promise<WeighingBatch>;
}
