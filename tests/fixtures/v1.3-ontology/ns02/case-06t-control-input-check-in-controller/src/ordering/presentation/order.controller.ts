import type { Order } from '../domain/order';
import type { PlaceOrderService } from '../application/place-order.service';

export interface CreateOrderDto {
  readonly sku: string;
  readonly quantity: number;
}

export class OrderController {
  constructor(private readonly placeOrder: PlaceOrderService) {}

  create(dto: CreateOrderDto): Order {
    if (!Number.isInteger(dto.quantity)) {
      throw new Error('quantity must be a whole number');
    }
    return this.placeOrder.place(dto.sku, dto.quantity);
  }
}
