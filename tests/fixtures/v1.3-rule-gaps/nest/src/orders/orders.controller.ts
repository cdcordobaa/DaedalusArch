import { Controller } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';

// violating (controller-bypasses-application): the controller injects the repository, not the service.
@Controller('orders')
export class OrdersController {
  constructor(private readonly repo: OrdersRepository) {}
  show(id: string): string {
    return this.repo.find(id);
  }
}
