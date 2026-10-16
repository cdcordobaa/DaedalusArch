import { DataSource } from 'typeorm';
import { PlaceOrderUseCase } from '../application/use-cases/place-order';
import { OrderController } from '../adapters/inbound/http/order-controller';
import { Order } from '../domain/entities/order';
import { TypeOrmOrderRepository } from '../adapters/outbound/persistence/typeorm-order-repository';

export function buildApp(dataSource: DataSource): { orders: OrderController } {
  const orders = new TypeOrmOrderRepository(dataSource.getRepository(Order));
  return { orders: new OrderController(new PlaceOrderUseCase(orders)) };
}
