import { LockerError } from '../../domain/LockerError';
import type { MaintainLockers } from '../ports/in/MaintainLockers';
import type { DoorLatch } from '../ports/out/DoorLatch';
import type { Lockers } from '../ports/out/Lockers';

export class LockerMaintenanceService implements MaintainLockers {
  constructor(
    private readonly lockers: Lockers,
    private readonly door: DoorLatch,
  ) {}

  outOfService(lockerId: string): { locker: string; inService: boolean } {
    const locker = this.lockers.byId(lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${lockerId}`);
    locker.takeOutOfService();
    this.lockers.save(locker);
    return { locker: locker.id, inService: locker.inService };
  }

  testDoor(lockerId: string): { locker: string; opened: boolean } {
    const locker = this.lockers.byId(lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${lockerId}`);
    return { locker: locker.id, opened: this.door.open(locker.buildingId, locker.bay) };
  }
}
