import { Controller, Post } from '@nestjs/common';
import { PlaceOrder } from '../application/place-order';
import { Money } from '../domain/money';

@Controller('orders')
export class OrdersController {
  constructor(private readonly placeOrder: PlaceOrder) {}

  /** NEAR-MISS N1: the endpoint goes through the application layer. */
  @Post()
  create(): Money {
    return this.placeOrder.execute('sku-1');
  }
}
