import type { StockOrder } from '../../../domain/model/admin/StockOrder';
import type { StockOrderStore } from '../../ports/out/admin/StockOrderStore';

/** Staff-side list of an order of dental supplies */
export class StockOrderService {
  constructor(private readonly store: StockOrderStore) {}

  async add(id: string, text: string, at: string): Promise<StockOrder> {
    if (text.trim() === '') throw new Error('text is required');
    const item: StockOrder = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<StockOrder[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
