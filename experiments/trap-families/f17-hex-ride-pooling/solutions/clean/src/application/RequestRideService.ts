import { Location } from '../domain/Location';
import { RideError } from '../domain/RideError';
import { RoadTimesPaused } from '../domain/RoadTimesPaused';
import { Matching, type Candidate } from '../domain/pooling/Matching';
import { Pool } from '../domain/pooling/Pool';
import { StraightLineTimes } from '../domain/pooling/StraightLineTimes';
import type { OpenPools } from './outbound/OpenPools';
import type { PickupAreas } from './outbound/PickupAreas';
import type { RoadTimes } from './outbound/RoadTimes';
import type { RequestRide, RideAnswer, RideRequest } from './RequestRide';

export class RequestRideService implements RequestRide {
  constructor(
    private readonly areas: PickupAreas,
    private readonly pools: OpenPools,
    private readonly road: RoadTimes,
    private readonly straight: StraightLineTimes = new StraightLineTimes(),
    private readonly matching: Matching = new Matching(),
  ) {}

  async request(ride: RideRequest): Promise<RideAnswer> {
    if (ride.rider.trim() === '') throw new RideError('a ride needs the rider\'s name');
    const pickup = Location.of(ride.pickup[0], ride.pickup[1]);
    const dropoff = Location.of(ride.dropoff[0], ride.dropoff[1]);
    await this.checkAreas(pickup, dropoff);

    const open = this.pools.withFreeSeats();
    const { candidates, estimated } = open.length === 0 ? { candidates: [], estimated: false } : await this.candidates(open, pickup, dropoff);
    const chosen = this.matching.choose(candidates);
    if (chosen === undefined) {
      const pool = Pool.open(this.pools.nextId(), ride.rider, pickup, dropoff);
      this.pools.save(pool);
      return { pool: pool.id, joined: false, addedMinutes: 0, estimated };
    }
    chosen.pool.take(ride.rider, pickup, dropoff);
    this.pools.save(chosen.pool);
    return { pool: chosen.pool.id, joined: true, addedMinutes: Math.round(chosen.addedSeconds / 60), estimated };
  }

  /** Road times for every open pool; while road times are paused, our straight-line estimate (ferries unknown). */
  private async candidates(open: Pool[], pickup: Location, dropoff: Location): Promise<{ candidates: Candidate[]; estimated: boolean }> {
    try {
      const out: Candidate[] = [];
      for (const pool of open) {
        const without = await this.road.tripTime(pool.stops());
        const withRider = await this.road.tripTime(pool.stopsWith(pickup, dropoff));
        out.push({ pool, poolSeconds: without.seconds, addedSeconds: withRider.seconds - without.seconds, byFerry: withRider.byFerry });
      }
      return { candidates: out, estimated: false };
    } catch (e) {
      if (!(e instanceof RoadTimesPaused)) throw e;
      return {
        candidates: open.map((pool) => {
          const poolSeconds = this.straight.seconds(pool.stops());
          return { pool, poolSeconds, addedSeconds: this.straight.seconds(pool.stopsWith(pickup, dropoff)) - poolSeconds, byFerry: false };
        }),
        estimated: true,
      };
    }
  }

  private async checkAreas(pickup: Location, dropoff: Location): Promise<void> {
    const at = await this.areas.statusAt(pickup);
    if (at === 'outside') throw new RideError('the pickup is outside the area we serve');
    if (at === 'drop-off only') throw new RideError('pickups are not allowed at this place');
    if ((await this.areas.statusAt(dropoff)) === 'outside') throw new RideError('the drop-off is outside the area we serve');
  }
}
