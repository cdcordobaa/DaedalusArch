import { CustomerGateway } from '../../persistence/CustomerGateway';
import { OrderGateway } from '../../persistence/OrderGateway';
import { ProductGateway } from '../../persistence/ProductGateway';
import { BusinessError } from '../errors/BusinessError';
import { Money } from '../model/Money';
import { Order } from '../model/Order';
import { OrderLine } from '../model/OrderLine';
import { PricingPolicy } from './PricingPolicy';
import { toCustomer, toOrder, toOrderRecord, toProduct } from './RecordMapping';

export interface OrderItem {
  sku: string;
  quantity: number;
}

/** Service Layer (Fowler 2002): one transaction script per use of the order screen. */
export class OrderService {
  private readonly pricing = new PricingPolicy();
  private sequence = 0;

  constructor(
    private readonly orders: OrderGateway,
    private readonly products: ProductGateway,
    private readonly customers: CustomerGateway,
  ) {}

  placeOrder(customerId: string, items: readonly OrderItem[]): Order {
    const customerRecord = this.customers.findById(customerId);
    if (customerRecord === undefined) throw new BusinessError('NOT_FOUND', `No customer ${customerId}`);

    const lines = items.map((item) => {
      const record = this.products.findBySku(item.sku);
      if (record === undefined) throw new BusinessError('NOT_FOUND', `No product ${item.sku}`);
      const product = toProduct(record);
      product.reserve(item.quantity);
      this.products.updateStock(product.sku, product.stock);
      return new OrderLine(product.sku, item.quantity, product.price);
    });

    const draft = new Order(this.nextId(), customerId, lines, new Date(), this.pricing.discountFor(toCustomer(customerRecord), sumOf(lines)));
    this.orders.save(toOrderRecord(draft));
    return draft;
  }

  cancelOrder(orderId: string): Order {
    const order = this.getOrder(orderId);
    order.cancel();
    for (const line of order.lines) {
      const record = this.products.findBySku(line.sku);
      if (record !== undefined) this.products.updateStock(line.sku, record.stock + line.quantity);
    }
    this.orders.save(toOrderRecord(order));
    return order;
  }

  getOrder(orderId: string): Order {
    const record = this.orders.findById(orderId);
    if (record === undefined) throw new BusinessError('NOT_FOUND', `No order ${orderId}`);
    return toOrder(record);
  }

  private nextId(): string {
    this.sequence += 1;
    return `ord-${this.sequence}`;
  }
}

function sumOf(lines: readonly OrderLine[]): Money {
  return lines.reduce((sum, line) => sum.add(line.total()), Money.zero());
}
