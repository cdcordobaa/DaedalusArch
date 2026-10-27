import { RouteKitQuotaError } from 'routekit-sdk';
import { Location } from '../domain/Location';
import { RideError } from '../domain/RideError';
import { Matching, type Candidate } from '../domain/pooling/Matching';
import { Pool } from '../domain/pooling/Pool';
import { StraightLineTimes } from '../domain/pooling/StraightLineTimes';
import type { OpenPools } from './outbound/OpenPools';
import type { PickupAreas } from './outbound/PickupAreas';
import type { RoutePlanner } from './outbound/RoutePlanner';
import type { RequestRide, RideAnswer, RideRequest } from './RequestRide';

export class RequestRideService implements RequestRide {
  private pausedUntil = 0;

  constructor(
    private readonly areas: PickupAreas,
    private readonly pools: OpenPools,
    private readonly routes: RoutePlanner,
    private readonly times: StraightLineTimes = new StraightLineTimes(),
    private readonly matching: Matching = new Matching(),
  ) {}

  async request(ride: RideRequest): Promise<RideAnswer> {
    if (ride.rider.trim() === '') throw new RideError('a ride needs the rider\'s name');
    const pickup = Location.of(ride.pickup[0], ride.pickup[1]);
    const dropoff = Location.of(ride.dropoff[0], ride.dropoff[1]);
    await this.checkAreas(pickup, dropoff);

    const open = this.pools.withFreeSeats();
    let estimated = Date.now() < this.pausedUntil && open.length > 0;
    let candidates: Candidate[] = [];
    if (!estimated) {
      try {
        for (const pool of open) {
          const before = await this.routes.route({ waypoints: pool.stops().map((s) => ({ lat: s.latitude, lng: s.longitude })), profile: 'CAR' });
          const after = await this.routes.route({ waypoints: pool.stopsWith(pickup, dropoff).map((s) => ({ lat: s.latitude, lng: s.longitude })), profile: 'CAR' });
          if (after.legs.some((l) => l.features.includes('FERRY'))) continue;
          candidates.push({ pool, addedSeconds: after.totalDurationSec - before.totalDurationSec, limitSeconds: before.totalDurationSec > 2400 ? 720 : 480 });
        }
      } catch (e) {
        if (!(e instanceof RouteKitQuotaError)) throw e;
        this.pausedUntil = Date.now() + e.retryAfterSec * 1000;
        estimated = true;
      }
    }
    if (estimated) {
      candidates = open.map((pool) => {
        const s = this.times.seconds(pool.stops());
        return { pool, addedSeconds: this.times.seconds(pool.stopsWith(pickup, dropoff)) - s, limitSeconds: s > 2400 ? 720 : 480 };
      });
    }
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

  private async checkAreas(pickup: Location, dropoff: Location): Promise<void> {
    const at = await this.areas.statusAt(pickup);
    if (at === 'outside') throw new RideError('the pickup is outside the area we serve');
    if (at === 'drop-off only') throw new RideError('pickups are not allowed at this place');
    if ((await this.areas.statusAt(dropoff)) === 'outside') throw new RideError('the drop-off is outside the area we serve');
  }
}
