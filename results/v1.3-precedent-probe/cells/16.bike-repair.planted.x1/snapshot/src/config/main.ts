import express from 'express';
import { workshopRoutes } from '../adapters/inbound/http-routes';
import { InMemoryWorkOrderRepository } from '../adapters/outbound/in-memory-work-order-repository';
import { SpokeSupplyClient } from '../adapters/outbound/spoke-supply-client';
import { CloseWorkOrder } from '../application/close-work-order';
import { OpenWorkOrder } from '../application/open-work-order';
import { OrderMissingPart } from '../application/order-missing-part';
import { QuoteRepair } from '../application/quote-repair';

export function buildApp(): express.Express {
  const orders = new InMemoryWorkOrderRepository();
  const spokeSupply = new SpokeSupplyClient();
  const app = express();
  app.use(express.json());
  app.use(
    workshopRoutes({
      openWorkOrder: new OpenWorkOrder(orders),
      quoteRepair: new QuoteRepair(orders, spokeSupply),
      closeWorkOrder: new CloseWorkOrder(orders),
      orderMissingPart: new OrderMissingPart(orders, spokeSupply),
    }),
  );
  return app;
}

if (require.main === module) {
  buildApp().listen(3000, () => console.log('bike workshop on :3000'));
}
