import type { Order } from '../domain/order';
import type { PlaceOrderService } from '../application/place-order.service';

const MAX_QUANTITY = 20;

export interface CreateOrderDto {
  readonly sku: string;
  readonly quantity: number;
  readonly giftNote: string;
}

export class OrderController {
  constructor(private readonly placeOrder: PlaceOrderService) {}

  create(dto: CreateOrderDto): Order {
    if (dto.quantity > MAX_QUANTITY) throw new Error('quantity too high');
    return this.placeOrder.place(dto.sku, dto.quantity, dto.giftNote);
  }
}
