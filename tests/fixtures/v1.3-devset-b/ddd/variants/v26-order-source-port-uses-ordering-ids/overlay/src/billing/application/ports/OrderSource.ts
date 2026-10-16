import type { OrderId } from '../../../ordering/domain/order/value-objects/OrderId.js';
import type { CustomerId } from '../../../ordering/domain/customer/value-objects/CustomerId.js';

/** Port: what billing needs to know about an order, in billing's own terms. */
export interface BillableOrder {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly orderRef?: OrderId;
  readonly customer?: CustomerId;
}

export interface OrderSource {
  billableOrder(orderId: string): Promise<BillableOrder | null>;
}
