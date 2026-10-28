import type { Kitchen } from '../../../application/ports/in/Kitchen';
import { reply, type Reply } from '../shared/reply';

/** The kitchen's morning screens. */
export class KitchenRoutes {
  constructor(private readonly kitchen: Kitchen) {}

  tally(date: unknown): Reply {
    return reply(() => this.kitchen.tally(date));
  }
}
