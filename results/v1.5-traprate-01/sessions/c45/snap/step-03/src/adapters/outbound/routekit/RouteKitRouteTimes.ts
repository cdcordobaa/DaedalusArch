import { RouteKitQuotaError, type RouteKitClient } from 'routekit-sdk';
import type { DriveTime, RouteTimes } from '../../../application/outbound/RouteTimes';
import type { Location } from '../../../domain/Location';
import { StraightLineTimes } from '../../../domain/pooling/StraightLineTimes';

/** RouteKit's car routes, read as road times; straight-line estimates while the route quota is used up. */
export class RouteKitRouteTimes implements RouteTimes {
  private pausedUntil = 0;

  constructor(
    private readonly client: RouteKitClient,
    private readonly fallback: StraightLineTimes = new StraightLineTimes(),
    private readonly now: () => number = Date.now,
  ) {}

  async seconds(stops: readonly Location[]): Promise<DriveTime> {
    if (this.now() < this.pausedUntil) return this.estimate(stops);
    try {
      const route = await this.client.route({
        waypoints: stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
        profile: 'CAR',
      });
      const usesFerry = route.legs.some((leg) => leg.features.includes('FERRY'));
      return { seconds: route.totalDurationSec, estimated: false, usesFerry };
    } catch (e) {
      if (!(e instanceof RouteKitQuotaError)) throw e;
      this.pausedUntil = this.now() + e.retryAfterSec * 1000;
      return this.estimate(stops);
    }
  }

  private estimate(stops: readonly Location[]): DriveTime {
    return { seconds: this.fallback.seconds(stops), estimated: true, usesFerry: false };
  }
}
