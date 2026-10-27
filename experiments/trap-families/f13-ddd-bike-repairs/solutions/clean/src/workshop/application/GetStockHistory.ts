import { MAIN_STOCKROOM } from '../domain/stock/Stockroom';
import type { StockroomRepository } from '../domain/stock/StockroomRepository';
import { Sku } from '../domain/stock/value-objects/Sku';
import { WorkshopError } from '../domain/WorkshopError';

export interface StockHistoryLine {
  readonly kind: string;
  readonly quantity: number;
  readonly jobId: string | null;
}

export class GetStockHistory {
  constructor(private readonly stockrooms: StockroomRepository) {}

  execute(sku: string): StockHistoryLine[] {
    const stockroom = this.stockrooms.byId(MAIN_STOCKROOM);
    if (stockroom === undefined) throw new WorkshopError(`no stockroom ${MAIN_STOCKROOM}`);
    return stockroom.history(Sku.of(sku)).map((m) => ({ kind: m.kind, quantity: m.quantity, jobId: m.jobId }));
  }
}
