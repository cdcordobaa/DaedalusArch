import { CustomerRecord } from '../../persistence/records/CustomerRecord';
import { OrderRecord } from '../../persistence/records/OrderRecord';
import { ProductRecord } from '../../persistence/records/ProductRecord';
import { Customer } from '../model/Customer';
import { Money } from '../model/Money';
import { Order } from '../model/Order';
import { OrderLine } from '../model/OrderLine';
import { Product } from '../model/Product';

/** The business layer maps the rows the gateways return; the persistence layer never sees a business object. */
export function toProduct(record: ProductRecord): Product {
  return new Product(record.sku, record.name, Money.ofCents(record.priceCents), record.stock);
}

export function toCustomer(record: CustomerRecord): Customer {
  return new Customer(record.id, record.name, record.email, record.loyaltyTier);
}

export function toOrder(record: OrderRecord): Order {
  const lines = record.lines.map((l) => new OrderLine(l.sku, l.quantity, Money.ofCents(l.unitPriceCents)));
  return new Order(record.id, record.customerId, lines, new Date(record.createdAt), Money.ofCents(record.discountCents), record.status);
}

export function toOrderRecord(order: Order): OrderRecord {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    discountCents: order.discount.cents,
    lines: order.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPriceCents: l.unitPrice.cents })),
  };
}
