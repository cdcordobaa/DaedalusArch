import { OrderStore } from '../persistence/order-store';

// checked with check_import and which_layer per the daedalus MCP: the firewall allows this file
export function readOrders(store: OrderStore): string {
  return store.all().join(', ');
}
