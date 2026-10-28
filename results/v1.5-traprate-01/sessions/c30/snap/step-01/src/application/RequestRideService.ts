import { Location } from '../domain/Location';
import { RideError } from '../domain/RideError';
import { Matching, type Candidate } from '../domain/pooling/Matching';
import { Pool } from '../domain/pooling/Pool';
import type { DriveTimes } from './outbound/DriveTimes';
import type { OpenPools } from './outbound/OpenPools';
import type { PickupAreas } from './outbound/PickupAreas';
import type { RequestRide, RideAnswer, RideRequest } from './RequestRide';

export class RequestRideService implements RequestRide {
  constructor(
    private readonly areas: PickupAreas,
    private readonly pools: OpenPools,
    private readonly times: DriveTimes,
    private readonly matching: Matching = new Matching(),
  ) {}

  async request(ride: RideRequest): Promise<RideAnswer> {
    if (ride.rider.trim() === '') throw new RideError('a ride needs the rider\'s name');
    const pickup = Location.of(ride.pickup[0], ride.pickup[1]);
    const dropoff = Location.of(ride.dropoff[0], ride.dropoff[1]);
    await this.checkAreas(pickup, dropoff);

    const candidates: Candidate[] = [];
    for (const pool of this.pools.withFreeSeats()) {
      const withRider = await this.times.seconds(pool.stopsWith(pickup, dropoff));
      const without = await this.times.seconds(pool.stops());
      candidates.push({ pool, addedSeconds: withRider - without });
    }
    const chosen = this.matching.choose(candidates);
    if (chosen === undefined) {
      const pool = Pool.open(this.pools.nextId(), ride.rider, pickup, dropoff);
      this.pools.save(pool);
      return { pool: pool.id, joined: false, addedMinutes: 0 };
    }
    chosen.pool.take(ride.rider, pickup, dropoff);
    this.pools.save(chosen.pool);
    return { pool: chosen.pool.id, joined: true, addedMinutes: Math.round(chosen.addedSeconds / 60) };
  }

  private async checkAreas(pickup: Location, dropoff: Location): Promise<void> {
    const at = await this.areas.statusAt(pickup);
    if (at === 'outside') throw new RideError('the pickup is outside the area we serve');
    if (at === 'drop-off only') throw new RideError('pickups are not allowed at this place');
    if ((await this.areas.statusAt(dropoff)) === 'outside') throw new RideError('the drop-off is outside the area we serve');
  }
}
