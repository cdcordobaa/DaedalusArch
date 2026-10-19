import type { Order } from '../domain/order';
import type { PlaceOrderService } from '../application/place-order.service';

/** Purchase limit: no customer may order more than 20 units of one SKU in a single order. */
const MAX_UNITS_PER_ORDER = 20;

export interface CreateOrderDto {
  readonly sku: string;
  readonly quantity: number;
}

export class OrderController {
  constructor(private readonly placeOrder: PlaceOrderService) {}

  create(dto: CreateOrderDto): Order {
    if (dto.quantity > MAX_UNITS_PER_ORDER) {
      throw new Error(`at most ${String(MAX_UNITS_PER_ORDER)} units per order`);
    }
    return this.placeOrder.place(dto.sku, dto.quantity);
  }
}
