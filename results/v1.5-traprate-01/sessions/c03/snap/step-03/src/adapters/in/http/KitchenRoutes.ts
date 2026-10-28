import type { Tally } from '../../../application/ports/in/Tally';
import { reply, type Reply } from '../shared/reply';

/** The kitchen's morning screens. */
export class KitchenRoutes {
  constructor(private readonly tallies: Tally) {}

  tally(date: unknown): Reply {
    return reply(() => this.tallies.tally(date));
  }
}
