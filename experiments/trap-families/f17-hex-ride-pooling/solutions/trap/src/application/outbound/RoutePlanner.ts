import type { RkRoute, RkRouteRequest } from 'routekit-sdk';

export interface RoutePlanner {
  route(request: RkRouteRequest): Promise<RkRoute>;
}
