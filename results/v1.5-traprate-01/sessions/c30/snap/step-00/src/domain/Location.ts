import { RideError } from './RideError';

/** A place on the map, in degrees. Immutable. */
export class Location {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {}

  static of(latitude: number, longitude: number): Location {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new RideError('coordinates must be a latitude from -90 to 90 and a longitude from -180 to 180');
    }
    return new Location(latitude, longitude);
  }
}
