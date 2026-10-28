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

  state(): StockroomState {
    return { id: this.id, onHand: { ...this.counts } };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
