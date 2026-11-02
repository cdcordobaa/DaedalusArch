import type { AcceptDrops } from '../../../application/ports/in/AcceptDrops';
import { reply, type Reply } from './reply';

/** Routes for the laundry's van drivers: POST /drops, GET /drops/:id. */
export class LaundryRoutes {
  constructor(private readonly intake: AcceptDrops) {}

  dropOff(buildingId: string, apartment: string, size: string): Reply {
    return reply(() => this.intake.dropOff(buildingId, apartment, size));
  }

  drop(dropId: string): Reply {
    return reply(() => this.intake.drop(dropId));
  }
}
