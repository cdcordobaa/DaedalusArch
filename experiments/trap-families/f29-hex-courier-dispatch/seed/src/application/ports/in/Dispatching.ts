import type { JobView } from '../../../domain/DeliveryJob';
import type { LatLng } from '../../../domain/geo';
import type { RiderView } from '../../../domain/Rider';

export interface PostJob {
  run(request: { pickup: LatLng; dropoff: LatLng }): JobView;
}

export interface AssignRider {
  run(jobId: string, riderId: string): JobView;
}

export interface RecordPickup {
  run(jobId: string): JobView;
}

export interface ViewJob {
  run(jobId: string): JobView;
}

export interface RiderShifts {
  register(request: { name: string; trackerId: string }): RiderView;
  clockOff(riderId: string): RiderView;
}
