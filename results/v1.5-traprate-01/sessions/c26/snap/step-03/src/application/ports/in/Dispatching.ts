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

export interface ConfirmDelivery {
  run(jobId: string, riderId: string, proof: { signedBy: string; photoRef: string }): JobView;
}

export interface ViewJob {
  run(jobId: string): JobView;
}

export interface RiderSuggestion {
  readonly riderId: string;
  readonly distanceMeters: number;
}

export interface SuggestRider {
  run(jobId: string): Promise<RiderSuggestion | null>;
}

export interface EstimateArrival {
  /** Whole minutes until the picked-up job reaches its drop-off point. */
  run(jobId: string): Promise<number>;
}

export interface RiderShifts {
  register(request: { name: string; trackerId: string }): RiderView;
  clockOff(riderId: string): RiderView;
}
