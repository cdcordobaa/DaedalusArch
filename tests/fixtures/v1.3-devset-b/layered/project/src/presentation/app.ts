import { createServices } from '../business/ServiceFactory';
import { CatalogController } from './http/CatalogController';
import { OrderController } from './http/OrderController';
import { Router } from './Router';

export function createApp(): Router {
  const services = createServices();
  return new Router(new CatalogController(services.catalog), new OrderController(services.orders));
}
