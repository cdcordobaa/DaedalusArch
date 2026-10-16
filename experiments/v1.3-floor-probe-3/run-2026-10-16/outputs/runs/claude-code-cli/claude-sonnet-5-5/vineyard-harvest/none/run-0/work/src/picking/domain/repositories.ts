import type { Block } from "./block.js";
import type { ApprovedWeek, BinOutcome, PayRules } from "./pay.js";
import type { Picker } from "./picker.js";
import type { PickingDay } from "./picking-day.js";

export interface PickerRepository {
  save(p: Picker): void;
  find(id: string): Picker | undefined;
  list(): Picker[];
}
export interface BlockRepository {
  save(b: Block): void;
  find(id: string): Block | undefined;
  list(): Block[];
}
export interface PickingDayRepository {
  find(date: string): PickingDay | undefined;
  save(d: PickingDay): void;
}
export interface PayRulesRepository {
  get(): PayRules;
  save(r: PayRules): void;
}
export interface ApprovedWeekRepository {
  find(weekStart: string): ApprovedWeek | undefined;
  save(w: ApprovedWeek): void;
}
/** Picking's view of the cellar, implemented by an anti-corruption adapter. */
export interface BinOutcomeLookup {
  find(date: string, tag: number): BinOutcome;
}
