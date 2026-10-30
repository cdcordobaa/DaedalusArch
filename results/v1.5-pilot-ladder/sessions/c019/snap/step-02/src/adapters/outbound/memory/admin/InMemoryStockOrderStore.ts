import type { StockOrderStore } from '../../../../application/ports/out/admin/StockOrderStore';
import type { StockOrder } from '../../../../domain/model/admin/StockOrder';

export class InMemoryStockOrderStore implements StockOrderStore {
  private readonly items: StockOrder[] = [];

  async add(item: StockOrder): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<StockOrder[]> {
    return [...this.items];
  }
}
