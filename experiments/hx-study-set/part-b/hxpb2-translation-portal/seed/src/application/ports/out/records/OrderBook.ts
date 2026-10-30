import type { TranslationOrder } from '../../../../domain/model/TranslationOrder';

export interface OrderBook {
  record(order: TranslationOrder): Promise<void>;
  byNumber(orderNo: string): Promise<TranslationOrder | null>;
}
