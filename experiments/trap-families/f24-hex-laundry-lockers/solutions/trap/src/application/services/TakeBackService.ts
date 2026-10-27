import type { LockBankDriver } from '../../adapters/out/lockbank/LockBankDriver';
import { LockerError } from '../../domain/LockerError';
import type { DropView } from '../ports/in/AcceptDrops';
import type { TakeBackDrops } from '../ports/in/TakeBackDrops';
import type { Clock } from '../ports/out/Clock';
import type { Drops } from '../ports/out/Drops';
import type { Lockers } from '../ports/out/Lockers';
import { viewOf } from './views';

export class TakeBackService implements TakeBackDrops {
  constructor(
    private readonly drops: Drops,
    private readonly lockers: Lockers,
    private readonly lockbank: LockBankDriver,
    private readonly clock: Clock,
  ) {}

  takeBack(dropId: string): DropView {
    const drop = this.drops.byId(dropId);
    if (drop === undefined) throw new LockerError(`no drop ${dropId}`);
    const now = this.clock.now();
    drop.checkTakeBack(now);
    const locker = this.lockers.byId(drop.lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${drop.lockerId}`);
    const ack = this.lockbank.pulse({ hub: locker.buildingId, bay: locker.bay, holdMs: 800 });
    if (ack.result !== 'OPENED') throw new LockerError(`locker ${locker.id} did not open`);
    drop.giveBack(now);
    locker.empty();
    this.drops.save(drop);
    this.lockers.save(locker);
    return viewOf(drop);
  }
}
