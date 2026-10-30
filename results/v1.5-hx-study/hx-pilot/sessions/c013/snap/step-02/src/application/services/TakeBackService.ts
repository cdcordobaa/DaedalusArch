import { LockerError } from '../../domain/LockerError';
import type { DropView } from '../ports/in/AcceptDrops';
import type { TakeBackDrops } from '../ports/in/TakeBackDrops';
import type { Clock } from '../ports/out/Clock';
import type { Drops } from '../ports/out/Drops';
import type { LockerDoors } from '../ports/out/LockerDoors';
import type { Lockers } from '../ports/out/Lockers';
import { viewOf } from './views';

const MIN_WAIT_HOURS = 72;

export class TakeBackService implements TakeBackDrops {
  constructor(
    private readonly drops: Drops,
    private readonly lockers: Lockers,
    private readonly clock: Clock,
    private readonly doors: LockerDoors,
  ) {}

  takeBack(dropId: string): DropView {
    const drop = this.drops.byId(dropId);
    if (drop === undefined) throw new LockerError(`no drop ${dropId}`);
    const now = this.clock.now();
    drop.checkReturnable(now, MIN_WAIT_HOURS);
    const locker = this.lockers.byId(drop.lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${drop.lockerId}`);
    if (!this.doors.open(locker.buildingId, locker.bay)) throw new LockerError(`locker ${locker.id} did not open`);
    drop.takeBack(now);
    locker.empty();
    this.drops.save(drop);
    this.lockers.save(locker);
    return viewOf(drop);
  }
}
