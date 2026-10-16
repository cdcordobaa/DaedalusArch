// PA4: a deep import through a path alias.
import { OrderRepo } from '@app/orders/internal/order-repo';
// NM-PA2: the module `ledger` has no index, barrel or declared API: no public API to bypass.
import { Ledger } from '../ledger/ledger';
// NM-PA4: the declared entry file reached through the alias.
import type { OrderView } from '@app/orders';
export class Report {
  repo = new OrderRepo();
  ledger = new Ledger();
  last?: OrderView;
}
