import type { Stockroom } from './Stockroom';

export interface StockroomRepository {
  byId(id: string): Stockroom | undefined;
  /** Stores the stockroom and its pending events in one step. */
  save(stockroom: Stockroom): void;
}
