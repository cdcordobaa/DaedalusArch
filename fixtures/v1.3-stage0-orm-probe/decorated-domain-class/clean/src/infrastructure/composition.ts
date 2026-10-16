import { DataSource } from 'typeorm';
import { PlaceOrderUseCase } from '../application/use-cases/place-order';
import { OrderController } from './controllers/order-controller';
import { Order } from '../domain/entities/order';
import { TypeOrmOrderRepository } from './persistence/typeorm-order-repository';

export function buildApp(dataSource: DataSource): { orders: OrderController } {
  const orders = new TypeOrmOrderRepository(dataSource.getRepository(Order));
  return { orders: new OrderController(new PlaceOrderUseCase(orders)) };
}
