import { Injectable } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrdersRepository) {}
  get(id: string): string {
    return this.repo.find(id);
  }
}
