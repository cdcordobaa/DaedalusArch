import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';

// clean (nest-provider-not-visible): OrdersService is exported by the imported OrdersModule.
@Injectable()
export class BillingService {
  constructor(private readonly orders: OrdersService) {}
  bill(id: string): string {
    return this.orders.get(id);
  }
}
