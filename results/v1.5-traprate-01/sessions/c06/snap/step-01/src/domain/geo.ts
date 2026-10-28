import { DispatchRefusal } from './DispatchRefusal';

/** A point on the map in decimal degrees (WGS 84). */
export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in metres (haversine). */
export function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function requirePoint(p: LatLng, what: string): LatLng {
  const valid = Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  if (!valid) throw new DispatchRefusal(`the ${what} is not a valid point`);
  return { lat: p.lat, lng: p.lng };
}
