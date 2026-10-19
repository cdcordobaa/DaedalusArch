import { readOrders } from '../helpers/order-reader';

export function renderOrders(store: Parameters<typeof readOrders>[0]): string {
  return readOrders(store);
}
