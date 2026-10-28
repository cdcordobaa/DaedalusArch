import { Stockroom, type StockroomState } from '../domain/stock/Stockroom';
import type { StockroomRepository } from '../domain/stock/StockroomRepository';
import type { InMemoryOutbox } from './InMemoryOutbox';

/** Saving the stockroom stores its pending events in the shared outbox in the same step. */
export class InMemoryStockroomRepository implements StockroomRepository {
  private readonly rows = new Map<string, StockroomState>();

  constructor(private readonly outbox: InMemoryOutbox) {}

  byId(id: string): Stockroom | undefined {
    const row = this.rows.get(id);
    return row === undefined ? undefined : Stockroom.restore(row);
  }

  save(stockroom: Stockroom): void {
    const events = stockroom.pullEvents();
    this.rows.set(stockroom.id, stockroom.state());
    this.outbox.append(events);
  }
}
