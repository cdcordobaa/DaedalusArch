import { Order } from '../order/Order';
import { ServiceLevel } from './ServiceLevel';

// violating (aggregate-reference-by-identity): a constructor parameter property holds another aggregate's root.
// look-alike (aggregate-holds-service): ServiceLevel is a value, not a service.
export class Shipment {
  constructor(readonly id: string, private readonly order: Order, private readonly level: ServiceLevel) {}
  eta(): number {
    return this.level.days + (this.order.id.length > 0 ? 0 : 1);
  }
}
