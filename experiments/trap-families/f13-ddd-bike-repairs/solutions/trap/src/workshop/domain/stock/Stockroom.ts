import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { WorkshopError } from '../WorkshopError';
import type { Sku } from './value-objects/Sku';

/** The shop has one stockroom. */
export const MAIN_STOCKROOM = 'MAIN';

export interface StockroomState {
  readonly id: string;
  readonly onHand: Readonly<Record<string, number>>;
  readonly movements?: readonly StockMovement[];
}

export interface StockMovement {
  readonly kind: string;
  readonly sku: string;
  readonly quantity: number;
  readonly jobId: string | null;
}

/** The parts on the shop's shelves. A part's count is a whole number and never below zero. */
export class Stockroom {
  private pending: DomainEvent[] = [];
  private movements: StockMovement[] = [];

  private constructor(
    readonly id: string,
    private counts: Record<string, number>,
  ) {}

  static open(id: string): Stockroom {
    return new Stockroom(id, {});
  }

  static restore(state: StockroomState): Stockroom {
    const stockroom = new Stockroom(state.id, { ...state.onHand });
    stockroom.movements = [...(state.movements ?? [])];
    return stockroom;
  }

  onHand(sku: Sku): number {
    return this.counts[sku.value] ?? 0;
  }

  receive(sku: Sku, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new WorkshopError('a delivery must be a positive whole number of parts');
    this.counts[sku.value] = this.onHand(sku) + quantity;
    this.movements.push({ kind: 'received', sku: sku.value, quantity, jobId: null });
  }

  take(sku: Sku, quantity: number, jobId: string): void {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new WorkshopError('a part quantity must be a positive whole number');
    const have = this.counts[sku.value];
    if (have === undefined) throw new WorkshopError(`unknown part: ${sku.value}`);
    if (have < quantity) throw new WorkshopError(`not enough stock: ${sku.value} needs ${String(quantity)}, ${String(have)} on hand`);
    this.counts[sku.value] = have - quantity;
    this.movements.push({ kind: 'used', sku: sku.value, quantity, jobId });
  }

  history(sku: Sku): StockMovement[] {
    return this.movements.filter((m) => m.sku === sku.value).reverse();
  }

  state(): StockroomState {
    return { id: this.id, onHand: { ...this.counts }, movements: [...this.movements] };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
