import { hoursBetween } from '../../domain/Instant';
import { LockerError } from '../../domain/LockerError';
import type { Collected } from '../ports/in/CollectDrops';
import type { ReturnDrops } from '../ports/in/ReturnDrops';
import type { Clock } from '../ports/out/Clock';
import type { Drops } from '../ports/out/Drops';
import type { LockerDoors } from '../ports/out/LockerDoors';
import type { Lockers } from '../ports/out/Lockers';

const MIN_WAIT_HOURS = 72;

export class TakeBackService implements ReturnDrops {
  constructor(
    private readonly drops: Drops,
    private readonly lockers: Lockers,
    private readonly clock: Clock,
    private readonly doors: LockerDoors,
  ) {}

  takeBack(dropId: string): Collected {
    const drop = this.drops.byId(dropId);
    if (drop === undefined) throw new LockerError(`no drop ${dropId}`);
    if (!drop.waiting) throw new LockerError(`drop ${drop.id} is no longer waiting`);
    const now = this.clock.now();
    if (hoursBetween(drop.droppedAt, now) < MIN_WAIT_HOURS) {
      throw new LockerError(`drop ${drop.id} has waited less than ${MIN_WAIT_HOURS} hours`);
    }
    const locker = this.lockers.byId(drop.lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${drop.lockerId}`);
    if (!this.doors.open(locker.buildingId, locker.bay)) throw new LockerError(`locker ${locker.id} did not open`);
    drop.giveBack(now);
    locker.empty();
    this.drops.save(drop);
    this.lockers.save(locker);
    return { dropId: drop.id, lockerId: locker.id, bay: locker.bay };
  }
}
