import { LockerError } from '../../domain/LockerError';
import { hoursBetween } from '../../domain/Instant';
import { parsePickupCode } from '../../domain/PickupCode';
import type { Collected, CollectDrops } from '../ports/in/CollectDrops';
import type { ReturnDrops } from '../ports/in/ReturnDrops';
import type { Clock } from '../ports/out/Clock';
import type { Doors } from '../ports/out/Doors';
import type { Drops } from '../ports/out/Drops';
import type { Lockers } from '../ports/out/Lockers';

export class PickupService implements CollectDrops, ReturnDrops {
  constructor(
    private readonly drops: Drops,
    private readonly lockers: Lockers,
    private readonly clock: Clock,
    private readonly doors: Doors,
  ) {}

  pickup(buildingId: string, code: string): Collected {
    const typed = parsePickupCode(code);
    const drop = this.drops.waitingIn(buildingId).find((d) => d.releasedBy(typed));
    if (drop === undefined) throw new LockerError(`no waiting drop with code ${typed} in ${buildingId}`);
    const locker = this.lockers.byId(drop.lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${drop.lockerId}`);
    if (!this.doors.open(locker.buildingId, locker.bay, 800)) throw new LockerError(`locker ${locker.id} did not open`);
    drop.collect(this.clock.now());
    locker.empty();
    this.drops.save(drop);
    this.lockers.save(locker);
    return { dropId: drop.id, lockerId: locker.id, bay: locker.bay };
  }

  takeBack(dropId: string): Collected {
    const drop = this.drops.byId(dropId);
    if (drop === undefined) throw new LockerError(`no drop ${dropId}`);
    if (!drop.waiting) throw new LockerError(`drop ${drop.id} is no longer waiting`);
    const now = this.clock.now();
    if (hoursBetween(drop.droppedAt, now) < 72) throw new LockerError(`drop ${drop.id} has waited less than 72 hours`);
    const locker = this.lockers.byId(drop.lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${drop.lockerId}`);
    if (!this.doors.open(locker.buildingId, locker.bay, 800)) throw new LockerError(`locker ${locker.id} did not open`);
    drop.sendBack(now);
    locker.empty();
    this.drops.save(drop);
    this.lockers.save(locker);
    return { dropId: drop.id, lockerId: locker.id, bay: locker.bay };
  }
}
