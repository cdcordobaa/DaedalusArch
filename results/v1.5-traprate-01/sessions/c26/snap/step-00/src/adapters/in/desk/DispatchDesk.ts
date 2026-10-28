import type { AssignRider, PostJob, RecordPickup, RiderShifts, ViewJob } from '../../../application/ports/in/Dispatching';
import type { JobView } from '../../../domain/DeliveryJob';
import type { LatLng } from '../../../domain/geo';
import type { RiderView } from '../../../domain/Rider';

export interface DeskOperations {
  readonly post: PostJob;
  readonly assign: AssignRider;
  readonly pickup: RecordPickup;
  readonly view: ViewJob;
  readonly shifts: RiderShifts;
}

/** What the dispatchers' screen calls. Refusals are thrown as errors whose message the screen shows. */
export class DispatchDesk {
  constructor(private readonly ops: DeskOperations) {}

  registerRider(name: string, trackerId: string): RiderView {
    return this.ops.shifts.register({ name, trackerId });
  }

  clockOff(riderId: string): RiderView {
    return this.ops.shifts.clockOff(riderId);
  }

  postJob(pickup: LatLng, dropoff: LatLng): JobView {
    return this.ops.post.run({ pickup, dropoff });
  }

  assign(jobId: string, riderId: string): JobView {
    return this.ops.assign.run(jobId, riderId);
  }

  pickUp(jobId: string): JobView {
    return this.ops.pickup.run(jobId);
  }

  job(jobId: string): JobView {
    return this.ops.view.run(jobId);
  }
}
