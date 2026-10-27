import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import type { PartLine } from '../PartLine';
import { WorkshopError } from '../WorkshopError';
import type { StockMovement } from './StockMovement';
import type { Sku } from './value-objects/Sku';

/** The shop has one stockroom. */
export const MAIN_STOCKROOM = 'MAIN';

export interface StockroomState {
  readonly id: string;
  readonly onHand: Readonly<Record<string, number>>;
  readonly suppliedJobs: readonly string[];
  readonly movements: readonly StockMovement[];
}

/**
 * The parts on the shop's shelves. A part's count is a whole number and never below zero; a completed job's parts are
 * taken off once, whatever the number of deliveries.
 */
export class Stockroom {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    private counts: Record<string, number>,
    private suppliedJobs: string[],
    private movements: StockMovement[],
  ) {}

  static open(id: string): Stockroom {
    return new Stockroom(id, {}, [], []);
  }

  static restore(state: StockroomState): Stockroom {
    return new Stockroom(state.id, { ...state.onHand }, [...state.suppliedJobs], [...state.movements]);
  }

  onHand(sku: Sku): number {
    return this.counts[sku.value] ?? 0;
  }

  receive(sku: Sku, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new WorkshopError('a delivery must be a positive whole number of parts');
    this.counts[sku.value] = this.onHand(sku) + quantity;
    this.movements.push({ kind: 'received', sku: sku.value, quantity, jobId: null });
  }

  /** Refuses when a part was never stocked or there are not enough of it on the shelf. Changes nothing. */
  assertCanSupply(parts: readonly PartLine[]): void {
    for (const [sku, needed] of Stockroom.totals(parts)) {
      const have = this.counts[sku];
      if (have === undefined) throw new WorkshopError(`unknown part: ${sku}`);
      if (have < needed) throw new WorkshopError(`not enough stock: ${sku} needs ${String(needed)}, ${String(have)} on hand`);
    }
  }

  /** Takes a completed job's parts off the shelves, once per job. */
  supplyJob(jobId: string, parts: readonly PartLine[]): void {
    if (this.suppliedJobs.includes(jobId)) return;
    this.assertCanSupply(parts);
    for (const [sku, needed] of Stockroom.totals(parts)) {
      this.counts[sku] = (this.counts[sku] ?? 0) - needed;
      this.movements.push({ kind: 'used', sku, quantity: needed, jobId });
    }
    this.suppliedJobs.push(jobId);
  }

  history(sku: Sku): StockMovement[] {
    return this.movements.filter((m) => m.sku === sku.value).reverse();
  }

  state(): StockroomState {
    return { id: this.id, onHand: { ...this.counts }, suppliedJobs: [...this.suppliedJobs], movements: [...this.movements] };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private static totals(parts: readonly PartLine[]): Map<string, number> {
    const totals = new Map<string, number>();
    for (const line of parts) totals.set(line.sku, (totals.get(line.sku) ?? 0) + line.quantity);
    return totals;
  }
}
