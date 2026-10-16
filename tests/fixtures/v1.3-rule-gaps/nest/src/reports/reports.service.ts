import { Injectable } from '@nestjs/common';
import { FormatterService } from '../shared/formatter.service';
import { OrdersService } from '../orders/orders.service';

// violating (nest-provider-not-visible): ReportsModule does not import OrdersModule.
@Injectable()
export class ReportsService {
  constructor(private readonly orders: OrdersService, private readonly fmt: FormatterService) {}
  report(id: string): string {
    return this.fmt.format(this.orders.get(id));
  }
}
