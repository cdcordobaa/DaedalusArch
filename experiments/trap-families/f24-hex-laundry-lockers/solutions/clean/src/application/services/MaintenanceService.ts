import { LockerError } from '../../domain/LockerError';
import type { Locker } from '../../domain/Locker';
import type { MaintainLockers } from '../ports/in/MaintainLockers';
import type { LockerDoors } from '../ports/out/LockerDoors';
import type { Lockers } from '../ports/out/Lockers';

export class MaintenanceService implements MaintainLockers {
  constructor(
    private readonly lockers: Lockers,
    private readonly doors: LockerDoors,
  ) {}

  outOfService(lockerId: string): { locker: string; inService: boolean } {
    const locker = this.find(lockerId);
    locker.takeOutOfService();
    this.lockers.save(locker);
    return { locker: locker.id, inService: locker.inService };
  }

  testDoor(lockerId: string): { locker: string; opened: boolean } {
    const locker = this.find(lockerId);
    return { locker: locker.id, opened: this.doors.open(locker) };
  }

  private find(lockerId: string): Locker {
    const locker = this.lockers.byId(lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${lockerId}`);
    return locker;
  }
}
