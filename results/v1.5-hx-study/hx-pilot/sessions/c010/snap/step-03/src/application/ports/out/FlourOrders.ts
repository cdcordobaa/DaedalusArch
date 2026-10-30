import type { FlourOrder } from '../../../domain/model/FlourOrder';

export interface FlourOrders {
  save(order: FlourOrder): Promise<void>;
}
