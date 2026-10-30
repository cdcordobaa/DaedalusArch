import type { TranslationOrder } from '../../../domain/model/TranslationOrder';
import type { OrderBook } from '../../../application/ports/out/records/OrderBook';

export class InMemoryOrderBook implements OrderBook {
  private readonly byNo: Record<string, TranslationOrder> = {};

  async record(order: TranslationOrder): Promise<void> {
    this.byNo[order.orderNo] = order;
  }

  async byNumber(orderNo: string): Promise<TranslationOrder | null> {
    return this.byNo[orderNo] ?? null;
  }
}
