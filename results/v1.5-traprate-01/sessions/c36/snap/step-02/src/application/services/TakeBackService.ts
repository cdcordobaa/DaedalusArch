import { hoursBetween } from '../../domain/Instant';
import { LockerError } from '../../domain/LockerError';
import type { DropView } from '../ports/in/AcceptDrops';
import type { TakeBackDrops } from '../ports/in/TakeBackDrops';
import type { Clock } from '../ports/out/Clock';
import type { DoorLatch } from '../ports/out/DoorLatch';
import type { Drops } from '../ports/out/Drops';
import type { Lockers } from '../ports/out/Lockers';
import { viewOf } from './views';

const MIN_WAIT_HOURS = 72;

export class TakeBackService implements TakeBackDrops {
  constructor(
    private readonly drops: Drops,
    private readonly lockers: Lockers,
    private readonly clock: Clock,
    private readonly latch: DoorLatch,
  ) {}

  takeBack(dropId: string): DropView {
    const drop = this.drops.byId(dropId);
    if (drop === undefined) throw new LockerError(`no drop ${dropId}`);
    if (!drop.waiting) throw new LockerError(`drop ${drop.id} is no longer waiting`);
    const now = this.clock.now();
    if (hoursBetween(drop.droppedAt, now) < MIN_WAIT_HOURS) {
      throw new LockerError(`drop ${drop.id} has waited less than ${MIN_WAIT_HOURS} hours`);
    }
    const locker = this.lockers.byId(drop.lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${drop.lockerId}`);
    if (!this.latch.open(drop.buildingId, locker.bay)) throw new LockerError(`locker ${locker.id} did not open`);
    drop.giveBack(now);
    locker.empty();
    this.drops.save(drop);
    this.lockers.save(locker);
    return viewOf(drop);
  }
}
