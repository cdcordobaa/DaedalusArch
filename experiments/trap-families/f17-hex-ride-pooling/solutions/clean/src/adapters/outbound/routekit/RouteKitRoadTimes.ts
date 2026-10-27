import { RouteKitQuotaError, type RouteKitClient } from 'routekit-sdk';
import type { RoadTimes } from '../../../application/outbound/RoadTimes';
import type { Location } from '../../../domain/Location';
import { RoadTimesPaused } from '../../../domain/RoadTimesPaused';
import type { TripTime } from '../../../domain/pooling/TripTime';

/** RouteKit's car routes, read as our trip times. A quota answer pauses RouteKit until its retry time. */
export class RouteKitRoadTimes implements RoadTimes {
  private pausedUntil: Date | undefined;

  constructor(
    private readonly client: RouteKitClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async tripTime(stops: readonly Location[]): Promise<TripTime> {
    if (this.pausedUntil !== undefined && this.now() < this.pausedUntil) throw new RoadTimesPaused(this.pausedUntil);
    try {
      const route = await this.client.route({ waypoints: stops.map((s) => ({ lat: s.latitude, lng: s.longitude })), profile: 'CAR' });
      return { seconds: route.legs.reduce((sum, leg) => sum + leg.durationSec, 0), byFerry: route.legs.some((leg) => leg.features.includes('FERRY')) };
    } catch (e) {
      if (!(e instanceof RouteKitQuotaError)) throw e;
      this.pausedUntil = new Date(this.now().getTime() + e.retryAfterSec * 1000);
      throw new RoadTimesPaused(this.pausedUntil);
    }
  }
}
