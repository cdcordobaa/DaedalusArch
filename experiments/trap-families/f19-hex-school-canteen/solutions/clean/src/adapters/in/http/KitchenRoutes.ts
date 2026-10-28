import type { KitchenTally } from '../../../application/ports/in/KitchenTally';
import { reply, type Reply } from './reply';

/** The kitchen's morning screen. */
export class KitchenRoutes {
  constructor(private readonly kitchenTally: KitchenTally) {}

  tally(date: unknown): Reply {
    return reply(() => this.kitchenTally.tally(date));
  }
}
