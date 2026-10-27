import { RideError } from './RideError';

/** Road times cannot be had until a given time (our allowance of route estimates is used up). */
export class RoadTimesPaused extends RideError {
  constructor(readonly until: Date) {
    super(`road times are paused until ${until.toISOString()}`);
    this.name = 'RoadTimesPaused';
  }
}
