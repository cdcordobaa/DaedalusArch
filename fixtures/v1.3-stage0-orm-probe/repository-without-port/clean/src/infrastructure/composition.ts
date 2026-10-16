import { DataSource } from 'typeorm';
import { PlaceOrderUseCase } from '../application/use-cases/place-order';
import { OrderController } from './controllers/order-controller';
import { OrderSchema } from './persistence/order.schema';

export function buildApp(dataSource: DataSource): { orders: OrderController } {
  return { orders: new OrderController(new PlaceOrderUseCase(dataSource.getRepository(OrderSchema))) };
}
