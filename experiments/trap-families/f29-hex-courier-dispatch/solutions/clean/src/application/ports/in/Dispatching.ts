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

export interface Suggestion {
  readonly riderId: string;
  readonly distanceMeters: number;
}

export interface SuggestRider {
  run(jobId: string): Promise<Suggestion | null>;
}

export interface ConfirmDelivery {
  run(jobId: string, riderId: string, proof: { signedBy: string; photoRef: string }): JobView;
}

export interface EstimateArrival {
  /** Whole minutes until the parcel reaches its drop-off point. */
  run(jobId: string): Promise<number>;
}
