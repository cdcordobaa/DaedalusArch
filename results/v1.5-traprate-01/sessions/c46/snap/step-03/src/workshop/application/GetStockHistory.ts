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

  execute(sku: string): { items: StockHistoryItem[] } {
    const stockroom = this.stockrooms.byId(MAIN_STOCKROOM);
    if (stockroom === undefined) throw new WorkshopError(`no stockroom ${MAIN_STOCKROOM}`);
    return { items: stockroom.history(Sku.of(sku)) };
  }
}
