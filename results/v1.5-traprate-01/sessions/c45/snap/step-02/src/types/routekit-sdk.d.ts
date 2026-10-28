// Typings of the RouteKit maps and routing SDK (routekit-sdk 5.1), as shipped by the vendor.
declare module 'routekit-sdk' {
  export interface RkCoordinate {
    lat: number;
    lng: number;
  }
  export type RkProfile = 'CAR' | 'BIKE' | 'WALK';
  export type RkRoadFeature = 'TOLL' | 'FERRY' | 'HIGHWAY';
  export interface RkRouteRequest {
    waypoints: RkCoordinate[];
    profile: RkProfile;
  }
  export interface RkLeg {
    durationSec: number;
    distanceM: number;
    features: RkRoadFeature[];
  }
  export interface RkRoute {
    legs: RkLeg[];
    totalDurationSec: number;
    totalDistanceM: number;
    trafficModel: 'LIVE' | 'TYPICAL';
  }
  export interface RkZone {
    zoneId: string;
    kind: 'SERVICE' | 'NO_PICKUP' | 'AIRPORT';
  }
  export interface RkZoneResult {
    zones: RkZone[];
  }
  export class RouteKitError extends Error {
    readonly status: number;
  }
  /** Thrown when a quota of the account is used up; retry after retryAfterSec seconds. */
  export class RouteKitQuotaError extends RouteKitError {
    readonly retryAfterSec: number;
    readonly quotaName: string;
  }
  export class RouteKitClient {
    constructor(options: { apiKey: string });
    route(request: RkRouteRequest): Promise<RkRoute>;
    zonesAt(point: RkCoordinate): Promise<RkZoneResult>;
  }
}
