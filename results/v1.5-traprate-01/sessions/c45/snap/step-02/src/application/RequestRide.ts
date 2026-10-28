/** A rider asking for a seat, with pickup and drop-off as [latitude, longitude]. */
export interface RideRequest {
  readonly rider: string;
  readonly pickup: readonly [number, number];
  readonly dropoff: readonly [number, number];
}

/** The pool the rider is in, whether they joined an open one, and the minutes their stops add to its drive. */
export interface RideAnswer {
  readonly pool: string;
  readonly joined: boolean;
  readonly addedMinutes: number;
  /** True when the drive times were our straight-line estimate, not RouteKit's road times. */
  readonly estimated: boolean;
}

export interface RequestRide {
  request(ride: RideRequest): Promise<RideAnswer>;
}
