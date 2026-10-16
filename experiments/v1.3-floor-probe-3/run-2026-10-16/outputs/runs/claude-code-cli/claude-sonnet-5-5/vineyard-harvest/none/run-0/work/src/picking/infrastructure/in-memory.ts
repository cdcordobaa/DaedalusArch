import type { Block } from "../domain/block.js";
import type { Picker } from "../domain/picker.js";
import type { PickingDay } from "../domain/picking-day.js";
import { newPayRules, type ApprovedWeek, type PayRules } from "../domain/pay.js";
import type {
  ApprovedWeekRepository,
  BlockRepository,
  PayRulesRepository,
  PickerRepository,
  PickingDayRepository,
} from "../domain/repositories.js";

class MemoryStore<T extends { id: string }> {
  protected readonly items = new Map<string, T>();
  save(item: T): void {
    this.items.set(item.id, item);
  }
  find(id: string): T | undefined {
    return this.items.get(id);
  }
  list(): T[] {
    return [...this.items.values()];
  }
}

export class InMemoryPickerRepository extends MemoryStore<Picker> implements PickerRepository {}
export class InMemoryBlockRepository extends MemoryStore<Block> implements BlockRepository {}

export class InMemoryPayRulesRepository implements PayRulesRepository {
  private rules: PayRules = newPayRules();
  get(): PayRules {
    return this.rules;
  }
  save(r: PayRules): void {
    this.rules = r;
  }
}

export class InMemoryApprovedWeekRepository implements ApprovedWeekRepository {
  private readonly weeks = new Map<string, ApprovedWeek>();
  find(weekStart: string): ApprovedWeek | undefined {
    return this.weeks.get(weekStart);
  }
  save(w: ApprovedWeek): void {
    this.weeks.set(w.weekStart, w);
  }
}

export class InMemoryPickingDayRepository implements PickingDayRepository {
  private readonly days = new Map<string, PickingDay>();
  find(date: string): PickingDay | undefined {
    return this.days.get(date);
  }
  save(d: PickingDay): void {
    this.days.set(d.date, d);
  }
}
