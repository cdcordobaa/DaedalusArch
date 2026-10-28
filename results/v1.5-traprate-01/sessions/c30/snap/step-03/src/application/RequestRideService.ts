import { Location } from '../domain/Location';
import { RideError } from '../domain/RideError';
import { Matching, type Candidate } from '../domain/pooling/Matching';
import { Pool } from '../domain/pooling/Pool';
import { StraightLineTimes } from '../domain/pooling/StraightLineTimes';
import { DriveTimesQuotaExhausted, type Drive, type DriveTimes } from './outbound/DriveTimes';
import type { OpenPools } from './outbound/OpenPools';
import type { PickupAreas } from './outbound/PickupAreas';
import type { RequestRide, RideAnswer, RideRequest } from './RequestRide';

export class RequestRideService implements RequestRide {
  constructor(
    private readonly areas: PickupAreas,
    private readonly pools: OpenPools,
    private readonly times: DriveTimes,
    private readonly matching: Matching = new Matching(),
    private readonly estimate: StraightLineTimes = new StraightLineTimes(),
    private readonly now: () => number = Date.now,
  ) {}

  /** Epoch ms before which road times are not asked for again. */
  private pausedUntil = 0;

  async request(ride: RideRequest): Promise<RideAnswer> {
    if (ride.rider.trim() === '') throw new RideError('a ride needs the rider\'s name');
    const pickup = Location.of(ride.pickup[0], ride.pickup[1]);
    const dropoff = Location.of(ride.dropoff[0], ride.dropoff[1]);
    await this.checkAreas(pickup, dropoff);

    const open = [...this.pools.withFreeSeats()];
    let estimated = open.length > 0 && this.now() < this.pausedUntil;
    let candidates: Candidate[] = [];
    if (!estimated) {
      try {
        candidates = await this.candidates(open, pickup, dropoff, (s) => this.times.drive(s));
      } catch (e) {
        if (!(e instanceof DriveTimesQuotaExhausted)) throw e;
        this.pausedUntil = this.now() + e.retryAfterSeconds * 1000;
        estimated = true;
      }
    }
    if (estimated) candidates = await this.candidates(open, pickup, dropoff, (s) => Promise.resolve({ seconds: this.estimate.seconds(s), usesFerry: false }));
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

  private async candidates(
    open: readonly Pool[],
    pickup: Location,
    dropoff: Location,
    drive: (stops: readonly Location[]) => Promise<Drive>,
  ): Promise<Candidate[]> {
    const candidates: Candidate[] = [];
    for (const pool of open) {
      const withRider = await drive(pool.stopsWith(pickup, dropoff));
      const without = await drive(pool.stops());
      candidates.push({
        pool,
        addedSeconds: withRider.seconds - without.seconds,
        withoutSeconds: without.seconds,
        usesFerry: withRider.usesFerry,
      });
    }
    return candidates;
  }

  private async checkAreas(pickup: Location, dropoff: Location): Promise<void> {
    const at = await this.areas.statusAt(pickup);
    if (at === 'outside') throw new RideError('the pickup is outside the area we serve');
    if (at === 'drop-off only') throw new RideError('pickups are not allowed at this place');
    if ((await this.areas.statusAt(dropoff)) === 'outside') throw new RideError('the drop-off is outside the area we serve');
  }
}
