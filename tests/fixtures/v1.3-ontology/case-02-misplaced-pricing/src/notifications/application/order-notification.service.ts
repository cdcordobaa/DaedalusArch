import type { Order } from '../../ordering/domain/order';
import type { Mailer } from './mailer';

export class OrderNotificationService {
  constructor(private readonly mailer: Mailer) {}

  async sendConfirmation(order: Order): Promise<void> {
    const subtotal = order.subtotal();
    const discount = order.lines.length > 3 ? subtotal * 0.1 : 0;
    const payable = subtotal - discount;
    await this.mailer.send(order.customerEmail, 'Order confirmed', `Order ${order.id}: you pay ${payable.toFixed(2)}`);
  }
}
