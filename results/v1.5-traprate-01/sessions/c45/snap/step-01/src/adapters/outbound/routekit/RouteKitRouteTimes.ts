import type { RouteKitClient } from 'routekit-sdk';
import type { RouteTimes } from '../../../application/outbound/RouteTimes';
import type { Location } from '../../../domain/Location';

/** RouteKit's car routes, read as road times. */
export class RouteKitRouteTimes implements RouteTimes {
  constructor(private readonly client: RouteKitClient) {}

  async seconds(stops: readonly Location[]): Promise<number> {
    const route = await this.client.route({
      waypoints: stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
      profile: 'CAR',
    });
    return route.totalDurationSec;
  }
}
