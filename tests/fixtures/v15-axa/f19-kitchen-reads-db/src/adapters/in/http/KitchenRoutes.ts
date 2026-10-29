import { CanteenDatabase } from '../../out/memory/CanteenDatabase';
import { reply, type Reply } from '../shared/reply';

/** The kitchen's screen: how many orders the database holds. */
export class KitchenRoutes {
  constructor(private readonly db: CanteenDatabase) {}

  count(): Reply {
    return reply(() => this.db.orders.size);
  }
}
