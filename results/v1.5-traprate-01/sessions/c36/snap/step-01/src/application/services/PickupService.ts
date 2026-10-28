import { LockerError } from '../../domain/LockerError';
import { parsePickupCode } from '../../domain/PickupCode';
import type { Collected, CollectDrops } from '../ports/in/CollectDrops';
import type { Clock } from '../ports/out/Clock';
import type { DoorLatch } from '../ports/out/DoorLatch';
import type { Drops } from '../ports/out/Drops';
import type { Lockers } from '../ports/out/Lockers';

export class PickupService implements CollectDrops {
  constructor(
    private readonly drops: Drops,
    private readonly lockers: Lockers,
    private readonly clock: Clock,
    private readonly latch: DoorLatch,
  ) {}

  pickup(buildingId: string, code: string): Collected {
    const typed = parsePickupCode(code);
    const drop = this.drops.waitingIn(buildingId).find((d) => d.releasedBy(typed));
    if (drop === undefined) throw new LockerError(`no waiting drop with code ${typed} in ${buildingId}`);
    const locker = this.lockers.byId(drop.lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${drop.lockerId}`);
    if (!this.latch.open(buildingId, locker.bay)) throw new LockerError(`locker ${locker.id} did not open`);
    drop.collect(this.clock.now());
    locker.empty();
    this.drops.save(drop);
    this.lockers.save(locker);
    return { dropId: drop.id, lockerId: locker.id, bay: locker.bay };
  }
}
