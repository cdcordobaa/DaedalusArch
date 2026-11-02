import { parseApartment } from '../../domain/Apartment';
import { Drop } from '../../domain/Drop';
import { chooseLocker } from '../../domain/LockerChoice';
import { LockerError } from '../../domain/LockerError';
import { parseSize } from '../../domain/LockerSize';
import type { AcceptDrops, DropReceipt, DropView } from '../ports/in/AcceptDrops';
import type { Buildings } from '../ports/out/Buildings';
import type { Clock } from '../ports/out/Clock';
import type { CodeIssuer } from '../ports/out/CodeIssuer';
import type { Drops } from '../ports/out/Drops';
import type { Lockers } from '../ports/out/Lockers';
import { viewOf } from './views';

export class DropOffService implements AcceptDrops {
  constructor(
    private readonly buildings: Buildings,
    private readonly lockers: Lockers,
    private readonly drops: Drops,
    private readonly codes: CodeIssuer,
    private readonly clock: Clock,
  ) {}

  dropOff(buildingId: string, apartment: string, size: string): DropReceipt {
    if (this.buildings.byId(buildingId) === undefined) throw new LockerError(`no building ${buildingId}`);
    const flat = parseApartment(apartment);
    const load = parseSize(size);
    const locker = chooseLocker(this.lockers.inBuilding(buildingId), load);
    if (locker === undefined) throw new LockerError(`no free locker for size ${load} in ${buildingId}`);
    const inUse = new Set(this.drops.waitingIn(buildingId).map((d) => d.code));
    let code = this.codes.next();
    while (inUse.has(code)) code = this.codes.next();
    const drop = Drop.leave(this.drops.nextId(), buildingId, locker.id, flat, load, code, this.clock.now());
    locker.fill(drop.id);
    this.lockers.save(locker);
    this.drops.save(drop);
    return { dropId: drop.id, lockerId: locker.id, bay: locker.bay, code };
  }

  drop(dropId: string): DropView {
    const d = this.drops.byId(dropId);
    if (d === undefined) throw new LockerError(`no drop ${dropId}`);
    return viewOf(d);
  }
}
