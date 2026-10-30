import { CustomerNotifierPort } from '../../../application/ports/out/customer-notifier.port';
import { OrderStatus } from '../../../domain/order-status';

export class ConsoleCustomerNotifier implements CustomerNotifierPort {
  async notify(customerId: string, orderId: string, status: OrderStatus): Promise<void> {
    console.log(`[to ${customerId}] order ${orderId}: ${status}`);
  }
}
