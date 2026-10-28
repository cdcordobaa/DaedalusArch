import type { Location } from '../../domain/Location';

/** Thrown by DriveTimes when the road-time source refuses for now because its quota is used up. */
export class DriveTimesQuotaExhausted extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('the route quota is used up');
    this.name = 'DriveTimesQuotaExhausted';
  }
}

/** How long a car takes to drive through stops in order. */
export interface DriveTimes {
  seconds(stops: readonly Location[]): Promise<number>;
}
