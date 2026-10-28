import type { MaintainLockers } from '../../../application/ports/in/MaintainLockers';
import type { ManageBuildings } from '../../../application/ports/in/ManageBuildings';
import { reply, type Reply } from './reply';

/** Routes for building managers. */
export class ManagerRoutes {
  constructor(
    private readonly admin: ManageBuildings,
    private readonly maintenance: MaintainLockers,
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
    return reply(() => this.maintenance.outOfService(lockerId));
  }

  /** The door test after a repair: pulse the latch and say whether the door opened. */
  testDoor(lockerId: string): Reply {
    return reply(() => this.maintenance.testDoor(lockerId));
  }
}
