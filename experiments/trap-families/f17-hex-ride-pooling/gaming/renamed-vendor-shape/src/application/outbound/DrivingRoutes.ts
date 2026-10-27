/** A drive through stops, in our words. */
export interface DrivingRoute {
  readonly legs: { readonly durationSec: number; readonly features: readonly string[] }[];
  readonly totalDurationSec: number;
}

export interface RouteQuery {
  readonly waypoints: { lat: number; lng: number }[];
  readonly profile: string;
}

export interface DrivingRoutes {
  route(query: RouteQuery): Promise<DrivingRoute>;
}
