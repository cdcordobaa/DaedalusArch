import { LockerError } from '../../domain/LockerError';
import type { Collected } from '../ports/in/CollectDrops';
import type { ReturnDrops } from '../ports/in/ReturnDrops';
import type { Clock } from '../ports/out/Clock';
import type { DoorLatch } from '../ports/out/DoorLatch';
import type { Drops } from '../ports/out/Drops';
import type { Lockers } from '../ports/out/Lockers';

export class ReturnService implements ReturnDrops {
  constructor(
    private readonly drops: Drops,
    private readonly lockers: Lockers,
    private readonly clock: Clock,
    private readonly latch: DoorLatch,
  ) {}

  takeBack(dropId: string): Collected {
    const drop = this.drops.byId(dropId);
    if (drop === undefined) throw new LockerError(`no drop ${dropId}`);
    const now = this.clock.now();
    drop.assertReturnable(now);
    const locker = this.lockers.byId(drop.lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${drop.lockerId}`);
    if (!this.latch.open(locker.buildingId, locker.bay)) throw new LockerError(`locker ${locker.id} did not open`);
    drop.takeBack(now);
    locker.empty();
    this.drops.save(drop);
    this.lockers.save(locker);
    return { dropId: drop.id, lockerId: locker.id, bay: locker.bay };
  }
}
