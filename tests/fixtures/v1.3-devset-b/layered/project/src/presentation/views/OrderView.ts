import { Order } from '../../business/model/Order';

export interface OrderViewModel {
  id: string;
  status: string;
  lines: { sku: string; quantity: number; total: string }[];
  discount: string;
  total: string;
}

export function renderOrder(order: Order): OrderViewModel {
  return {
    id: order.id,
    status: order.status,
    lines: order.lines.map((line) => ({ sku: line.sku, quantity: line.quantity, total: line.total().format() })),
    discount: order.discount.format(),
    total: order.total().format(),
  };
}
