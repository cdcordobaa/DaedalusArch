import { OrderService } from './application/OrderService';
import { OrderRoutes } from './http/OrderRoutes';
import { PgOrderStore } from './persistence/PgOrderStore';

export const routes = new OrderRoutes(new OrderService(new PgOrderStore()));
