import { MAIN_STOCKROOM } from '../domain/stock/Stockroom';
import type { StockroomRepository } from '../domain/stock/StockroomRepository';
import { Sku } from '../domain/stock/value-objects/Sku';
import { WorkshopError } from '../domain/WorkshopError';

export class ReceiveParts {
  constructor(private readonly stockrooms: StockroomRepository) {}

  execute(sku: string, quantity: number): void {
    const stockroom = this.stockrooms.byId(MAIN_STOCKROOM);
    if (stockroom === undefined) throw new WorkshopError(`no stockroom ${MAIN_STOCKROOM}`);
    stockroom.receive(Sku.of(sku), quantity);
    this.stockrooms.save(stockroom);
  }
}
