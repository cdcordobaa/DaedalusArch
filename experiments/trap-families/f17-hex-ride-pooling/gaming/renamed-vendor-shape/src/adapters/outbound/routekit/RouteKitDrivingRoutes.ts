import type { RkRouteRequest, RouteKitClient } from 'routekit-sdk';
import type { DrivingRoute, DrivingRoutes, RouteQuery } from '../../../application/outbound/DrivingRoutes';

export class RouteKitDrivingRoutes implements DrivingRoutes {
  constructor(private readonly client: RouteKitClient) {}

  route(query: RouteQuery): Promise<DrivingRoute> {
    return this.client.route(query as RkRouteRequest);
  }
}
