import { OrderStatus } from '../../../domain/order-status';

export interface CustomerNotifierPort {
  notify(customerId: string, orderId: string, status: OrderStatus): Promise<void>;
}
