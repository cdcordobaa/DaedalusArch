import type { RkRoute, RkRouteRequest, RouteKitClient } from 'routekit-sdk';
import type { RoutePlanner } from '../../../application/outbound/RoutePlanner';

export class RouteKitRoutePlanner implements RoutePlanner {
  constructor(private readonly client: RouteKitClient) {}

  route(request: RkRouteRequest): Promise<RkRoute> {
    return this.client.route(request);
  }
}
