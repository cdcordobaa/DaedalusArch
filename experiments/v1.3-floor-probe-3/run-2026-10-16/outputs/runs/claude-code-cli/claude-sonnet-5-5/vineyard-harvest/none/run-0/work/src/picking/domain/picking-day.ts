import { DomainError, conflict } from "../../shared/errors.js";

export interface Bin {
  readonly tag: number;
  readonly blockId: string;
  readonly pickerId: string;
  readonly binType?: string;
}

/** Aggregate: one day's picking — who works which block, and the bins filled. */
export class PickingDay {
  private readonly assignments = new Map<string, Set<string>>(); // blockId -> pickerIds
  private readonly bins = new Map<number, Bin>();
  private readonly hours = new Map<string, number>(); // pickerId -> hours worked

  constructor(readonly date: string) {}

  assign(pickerId: string, blockId: string): void {
    const set = this.assignments.get(blockId) ?? new Set<string>();
    set.add(pickerId);
    this.assignments.set(blockId, set);
  }

  recordBin(tag: number, blockId: string, pickerId: string, binType?: string): Bin {
    if (!Number.isInteger(tag) || tag <= 0) throw new DomainError("tag must be a positive integer");
    if (!this.assignments.get(blockId)?.has(pickerId)) {
      throw new DomainError("picker is not assigned to this block on this day");
    }
    if (this.bins.has(tag)) throw conflict(`bin tag ${tag} already recorded on ${this.date}`);
    const bin: Bin = binType === undefined ? { tag, blockId, pickerId } : { tag, blockId, pickerId, binType };
    this.bins.set(tag, bin);
    return bin;
  }

  setHours(pickerId: string, hours: number): void {
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new DomainError("hours must be between 0 and 24");
    this.hours.set(pickerId, hours);
  }

  hoursOf(pickerId: string): number {
    return this.hours.get(pickerId) ?? 0;
  }

  listHours(): { pickerId: string; hours: number }[] {
    return [...this.hours].map(([pickerId, hours]) => ({ pickerId, hours }));
  }

  findBin(tag: number): Bin | undefined {
    return this.bins.get(tag);
  }

  listBins(): Bin[] {
    return [...this.bins.values()];
  }

  listAssignments(): { blockId: string; pickerIds: string[] }[] {
    return [...this.assignments].map(([blockId, s]) => ({ blockId, pickerIds: [...s] }));
  }
}
