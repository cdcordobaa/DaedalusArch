import type { Location } from '../Location';

const EARTH_RADIUS_KM = 6371;
const CITY_SPEED_KMH = 30;

const radians = (deg: number): number => (deg * Math.PI) / 180;

/** Our own estimate of a drive: the straight-line distance between consecutive stops at 30 km/h. */
export class StraightLineTimes {
  seconds(stops: readonly Location[]): number {
    let km = 0;
    for (let i = 0; i + 1 < stops.length; i += 1) km += this.km(stops[i]!, stops[i + 1]!);
    return (km / CITY_SPEED_KMH) * 3600;
  }

  private km(a: Location, b: Location): number {
    const dLat = radians(b.latitude - a.latitude);
    const dLon = radians(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
  }
}
