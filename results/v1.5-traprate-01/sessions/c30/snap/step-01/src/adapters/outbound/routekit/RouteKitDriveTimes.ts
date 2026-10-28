import type { RouteKitClient } from 'routekit-sdk';
import type { DriveTimes } from '../../../application/outbound/DriveTimes';
import type { Location } from '../../../domain/Location';

/** RouteKit's road time by car through the stops, in order. */
export class RouteKitDriveTimes implements DriveTimes {
  constructor(private readonly client: RouteKitClient) {}

  async seconds(stops: readonly Location[]): Promise<number> {
    const route = await this.client.route({
      waypoints: stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
      profile: 'CAR',
    });
    return route.totalDurationSec;
  }
}
