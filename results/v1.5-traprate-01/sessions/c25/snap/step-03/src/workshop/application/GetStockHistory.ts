import { MAIN_STOCKROOM } from '../domain/stock/Stockroom';
import type { StockroomRepository } from '../domain/stock/StockroomRepository';
import { Sku } from '../domain/stock/value-objects/Sku';
import { WorkshopError } from '../domain/WorkshopError';

export interface StockHistoryItem {
  readonly kind: 'received' | 'used';
  readonly quantity: number;
  readonly jobId: string | null;
}

export class GetStockHistory {
  constructor(private readonly stockrooms: StockroomRepository) {}

  /** Every delivery and use of the part, newest first. */
  execute(sku: string): { items: StockHistoryItem[] } {
    const stockroom = this.stockrooms.byId(MAIN_STOCKROOM);
    if (stockroom === undefined) throw new WorkshopError(`no stockroom ${MAIN_STOCKROOM}`);
    const items = stockroom.history(Sku.of(sku)).map(({ kind, quantity, jobId }) => ({ kind, quantity, jobId }));
    return { items };
  }
}
