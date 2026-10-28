import { RouteKitQuotaError, type RouteKitClient } from 'routekit-sdk';
import { DriveTimesQuotaExhausted, type Drive, type DriveTimes } from '../../../application/outbound/DriveTimes';
import type { Location } from '../../../domain/Location';

/** RouteKit's road time by car through the stops, in order. */
export class RouteKitDriveTimes implements DriveTimes {
  constructor(private readonly client: RouteKitClient) {}

  async seconds(stops: readonly Location[]): Promise<number> {
    return (await this.drive(stops)).seconds;
  }

  async drive(stops: readonly Location[]): Promise<Drive> {
    try {
      const route = await this.client.route({
        waypoints: stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
        profile: 'CAR',
      });
      return {
        seconds: route.totalDurationSec,
        usesFerry: route.legs.some((leg) => leg.features.includes('FERRY')),
      };
    } catch (e) {
      if (e instanceof RouteKitQuotaError) throw new DriveTimesQuotaExhausted(e.retryAfterSec);
      throw e;
    }
  }
}
