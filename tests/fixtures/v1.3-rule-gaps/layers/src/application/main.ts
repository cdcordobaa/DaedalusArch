// look-alike (use-case-framework-free): a composition root may wire the web framework.
import type { Request } from 'express';
import { ListOrders } from './use-cases/ListOrders';

export function bootstrap(_req: Request, list: ListOrders): ListOrders {
  return list;
}
