import { BadRequestException } from '@nestjs/common';
import { Order } from '../domain/order';
import { OrderConfirmer } from './order-confirmer';

export class ConfirmOrderService implements OrderConfirmer {
  private readonly orders = new Map<string, Order>();

  confirm(id: string): void {
    const order = this.orders.get(id);
    if (order === undefined) return;
    order.confirm();
  }

  /** PLANTED P2: an HTTP exception in the application layer. */
  validate(id: string): void {
    if (id.length > 36) throw new BadRequestException('id too long');
  }
}
