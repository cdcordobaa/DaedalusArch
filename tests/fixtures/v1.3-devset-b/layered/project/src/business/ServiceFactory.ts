import { InMemoryDatabase } from '../persistence/Database';
import { CustomerGateway } from '../persistence/CustomerGateway';
import { OrderGateway } from '../persistence/OrderGateway';
import { ProductGateway } from '../persistence/ProductGateway';
import { CatalogService } from './services/CatalogService';
import { OrderService } from './services/OrderService';

export interface BusinessServices {
  catalog: CatalogService;
  orders: OrderService;
}

/**
 * The business layer builds the layer below it, so the presentation layer only ever names business services
 * (closed layering, Buschmann et al. 1996, "Layers").
 */
export function createServices(): BusinessServices {
  const db = new InMemoryDatabase();
  const products = new ProductGateway(db);
  new CustomerGateway(db).insert({ id: 'c-1', name: 'Grace', email: 'grace@example.org', loyaltyTier: 'gold' });
  return {
    catalog: new CatalogService(products),
    orders: new OrderService(new OrderGateway(db), products, new CustomerGateway(db)),
  };
}
