import type { CollectDrops } from '../../../application/ports/in/CollectDrops';
import { reply, type Reply } from './reply';

/** The keypad on the locker bank posts here: POST /buildings/:id/pickups { code }. */
export class ResidentRoutes {
  constructor(private readonly pickups: CollectDrops) {}

  pickup(buildingId: string, code: string): Reply {
    return reply(() => this.pickups.pickup(buildingId, code));
  }
}
