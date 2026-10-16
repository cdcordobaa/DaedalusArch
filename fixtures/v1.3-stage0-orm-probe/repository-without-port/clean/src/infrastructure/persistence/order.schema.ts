import { EntitySchema } from 'typeorm';
import { Order } from '../../domain/entities/order';

export const OrderSchema = new EntitySchema<Order>({
  name: 'Order',
  target: Order,
  tableName: 'orders',
  columns: {
    id: { type: String, primary: true },
    customerId: { type: String },
    totalCents: { type: 'int' },
  },
});
