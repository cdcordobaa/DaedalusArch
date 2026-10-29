import type { StockOrder } from '../../../../domain/model/admin/StockOrder';

export interface StockOrderStore {
  add(item: StockOrder): Promise<void>;
  all(): Promise<StockOrder[]>;
}
