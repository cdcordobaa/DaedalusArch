import { Order } from '../domain/order/Order';
import { CustomerId } from '../domain/customer/value-objects/CustomerId';

// violating (service-stateless): the application service keeps the last order it placed.
export class PlaceOrderService {
  private last: Order | undefined;
  place(id: string, customer: string): Order {
    this.last = new Order(id, new CustomerId(customer));
    return this.last;
  }
}
