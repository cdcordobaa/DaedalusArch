import { Injectable } from '@nestjs/common';
import { OrdersRepository } from '../orders/orders.repository';

// violating (nest-provider-not-visible): OrdersModule is imported but does not export OrdersRepository.
@Injectable()
export class InvoiceService {
  constructor(private readonly repo: OrdersRepository) {}
  total(id: string): number {
    return this.repo.find(id).length;
  }
}
