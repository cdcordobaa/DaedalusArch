import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { WorkshopError } from '../WorkshopError';
import type { Sku } from './value-objects/Sku';

/** The shop has one stockroom. */
export const MAIN_STOCKROOM = 'MAIN';

export interface StockroomState {
  readonly id: string;
  readonly onHand: Readonly<Record<string, number>>;
}

/** The parts on the shop's shelves. A part's count is a whole number and never below zero. */
export class Stockroom {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    private counts: Record<string, number>,
  ) {}

  static open(id: string): Stockroom {
    return new Stockroom(id, {});
  }

  static restore(state: StockroomState): Stockroom {
    return new Stockroom(state.id, { ...state.onHand });
  }

  onHand(sku: Sku): number {
    return this.counts[sku.value] ?? 0;
  }

  receive(sku: Sku, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new WorkshopError('a delivery must be a positive whole number of parts');
    this.counts[sku.value] = this.onHand(sku) + quantity;
  }

  /** Takes all the parts off the shelf, or none of them if any line is refused. */
  remove(parts: ReadonlyArray<{ readonly sku: Sku; readonly quantity: number }>): void {
    const needed = new Map<string, number>();
    for (const { sku, quantity } of parts) {
      if (!Number.isInteger(quantity) || quantity <= 0) throw new WorkshopError('a quantity must be a positive whole number of parts');
      if (!(sku.value in this.counts)) throw new WorkshopError(`unknown part: ${sku.value}`);
      needed.set(sku.value, (needed.get(sku.value) ?? 0) + quantity);
    }
    for (const [sku, quantity] of needed) {
      const have = this.counts[sku] ?? 0;
      if (have < quantity) throw new WorkshopError(`not enough stock: ${sku} needs ${quantity}, ${have} on hand`);
    }
    for (const [sku, quantity] of needed) this.counts[sku] = (this.counts[sku] ?? 0) - quantity;
  }

  state(): StockroomState {
    return { id: this.id, onHand: { ...this.counts } };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
