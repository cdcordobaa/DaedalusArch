import { DataSource } from 'typeorm';
import { PlaceOrderUseCase } from '../application/use-cases/place-order';
import { OrderController } from './controllers/order-controller';
import { OrderRecord } from './persistence/order.orm-entity';
import { TypeOrmOrderRepository } from './persistence/typeorm-order-repository';
import { OrderReportService } from '../application/services/order-report.service';

export function buildApp(dataSource: DataSource): { orders: OrderController; reports: OrderReportService } {
  const orders = new TypeOrmOrderRepository(dataSource.getRepository(OrderRecord));
  return { orders: new OrderController(new PlaceOrderUseCase(orders)), reports: new OrderReportService(dataSource.manager) };
}
