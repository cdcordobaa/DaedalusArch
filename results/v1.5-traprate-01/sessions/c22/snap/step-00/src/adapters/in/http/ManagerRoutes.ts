import type { ManageBuildings } from '../../../application/ports/in/ManageBuildings';
import { LockerError } from '../../../domain/LockerError';
import type { LockBankDriver } from '../../out/lockbank/LockBankDriver';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from './reply';

/** Routes for building managers. */
export class ManagerRoutes {
  constructor(
    private readonly admin: ManageBuildings,
    private readonly lockerStore: MemoryLockers,
    private readonly lockbank: LockBankDriver,
  ) {}

  addBuilding(name: string): Reply {
    return reply(() => this.admin.addBuilding(name));
  }

  installLocker(buildingId: string, bay: number, size: string): Reply {
    return reply(() => this.admin.installLocker(buildingId, bay, size));
  }

  lockers(buildingId: string): Reply {
    return reply(() => this.admin.lockers(buildingId));
  }

  /** The manager's switch: no new drop goes into this locker until it is back in service. */
  outOfService(lockerId: string): Reply {
    return reply(() => {
      const locker = this.lockerStore.byId(lockerId);
      if (locker === undefined) throw new LockerError(`no locker ${lockerId}`);
      locker.takeOutOfService();
      this.lockerStore.save(locker);
      return { locker: locker.id, inService: locker.inService };
    });
  }

  /** The door test after a repair: pulse the latch and say whether the door opened. */
  testDoor(lockerId: string): Reply {
    return reply(() => {
      const locker = this.lockerStore.byId(lockerId);
      if (locker === undefined) throw new LockerError(`no locker ${lockerId}`);
      const ack = this.lockbank.pulse({ hub: locker.buildingId, bay: locker.bay, holdMs: 800 });
      return { locker: locker.id, opened: ack.result === 'OPENED' };
    });
  }
}
