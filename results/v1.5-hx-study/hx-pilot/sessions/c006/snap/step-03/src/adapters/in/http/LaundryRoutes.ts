import type { AcceptDrops } from '../../../application/ports/in/AcceptDrops';
import type { TakeBackDrops } from '../../../application/ports/in/TakeBackDrops';
import { reply, type Reply } from './reply';

/** Routes for the laundry's van drivers: POST /drops, GET /drops/:id, and taking uncollected laundry back. */
export class LaundryRoutes {
  constructor(
    private readonly intake: AcceptDrops,
    private readonly returns: TakeBackDrops,
  ) {}

  dropOff(buildingId: string, apartment: string, size: string): Reply {
    return reply(() => this.intake.dropOff(buildingId, apartment, size));
  }

  drop(dropId: string): Reply {
    return reply(() => this.intake.drop(dropId));
  }

  takeBack(dropId: string): Reply {
    return reply(() => this.returns.takeBack(dropId));
  }
}
