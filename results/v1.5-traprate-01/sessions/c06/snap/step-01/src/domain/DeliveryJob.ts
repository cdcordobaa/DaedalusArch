import { DispatchRefusal } from './DispatchRefusal';
import type { LatLng } from './geo';

export type JobStatus = 'waiting' | 'assigned' | 'picked-up';

export interface JobView {
  readonly id: string;
  readonly pickup: LatLng;
  readonly dropoff: LatLng;
  readonly status: JobStatus;
  readonly riderId: string | null;
  readonly postedAt: string;
  readonly pickedUpAt: string | null;
}

/** A parcel to carry from a pickup point to a drop-off point. */
export class DeliveryJob {
  private status: JobStatus = 'waiting';
  private rider: string | null = null;
  private pickedUpAt: Date | null = null;

  constructor(
    readonly id: string,
    readonly pickup: LatLng,
    readonly dropoff: LatLng,
    readonly postedAt: Date,
  ) {}

  get currentStatus(): JobStatus {
    return this.status;
  }

  get riderId(): string | null {
    return this.rider;
  }

  /** A rider holds the job from assignment until it is finished. */
  get holdsRider(): boolean {
    return this.status === 'assigned' || this.status === 'picked-up';
  }

  giveTo(riderId: string): void {
    if (this.status !== 'waiting') throw new DispatchRefusal(`job ${this.id} is already taken`);
    this.rider = riderId;
    this.status = 'assigned';
  }

  collect(at: Date): void {
    if (this.status === 'waiting') throw new DispatchRefusal(`job ${this.id} has no rider yet`);
    if (this.status !== 'assigned') throw new DispatchRefusal(`job ${this.id} is already picked up`);
    this.status = 'picked-up';
    this.pickedUpAt = at;
  }

  view(): JobView {
    return {
      id: this.id,
      pickup: this.pickup,
      dropoff: this.dropoff,
      status: this.status,
      riderId: this.rider,
      postedAt: this.postedAt.toISOString(),
      pickedUpAt: this.pickedUpAt?.toISOString() ?? null,
    };
  }
}
