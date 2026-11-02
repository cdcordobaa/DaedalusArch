import { Building } from '../../domain/Building';
import { Locker } from '../../domain/Locker';
import { LockerError } from '../../domain/LockerError';
import { parseSize } from '../../domain/LockerSize';
import type { LockerLine, ManageBuildings } from '../ports/in/ManageBuildings';
import type { Buildings } from '../ports/out/Buildings';
import type { LockerDoors } from '../ports/out/LockerDoors';
import type { Lockers } from '../ports/out/Lockers';

export class BuildingService implements ManageBuildings {
  constructor(
    private readonly buildings: Buildings,
    private readonly lockerBank: Lockers,
    private readonly doors: LockerDoors,
  ) {}

  addBuilding(name: string): { id: string } {
    const building = Building.register(this.buildings.nextId(), name);
    this.buildings.add(building);
    return { id: building.id };
  }

  installLocker(buildingId: string, bay: number, size: string): { id: string } {
    this.known(buildingId);
    const s = parseSize(size);
    if (this.lockerBank.inBuilding(buildingId).some((l) => l.bay === bay)) throw new LockerError(`bay ${String(bay)} of ${buildingId} already has a locker`);
    const locker = Locker.install(this.lockerBank.nextId(), buildingId, bay, s);
    this.lockerBank.save(locker);
    return { id: locker.id };
  }

  lockers(buildingId: string): LockerLine[] {
    this.known(buildingId);
    return this.lockerBank.inBuilding(buildingId).map((l) => ({ id: l.id, bay: l.bay, size: l.size, inService: l.inService, free: l.free }));
  }

  /** The manager's switch: no new drop goes into this locker until it is back in service. */
  outOfService(lockerId: string): { locker: string; inService: boolean } {
    const locker = this.locker(lockerId);
    locker.takeOutOfService();
    this.lockerBank.save(locker);
    return { locker: locker.id, inService: locker.inService };
  }

  setLatchFault(buildingId: string, bay: number, faulty: boolean): { locker: string; inService: boolean } {
    const locker = this.lockerBank.inBuilding(buildingId).find((l) => l.bay === bay);
    if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
    if (faulty) locker.takeOutOfService();
    else locker.returnToService();
    this.lockerBank.save(locker);
    return { locker: locker.id, inService: locker.inService };
  }

  /** The door test after a repair: pulse the latch and say whether the door opened. */
  testDoor(lockerId: string): { locker: string; opened: boolean } {
    const locker = this.locker(lockerId);
    return { locker: locker.id, opened: this.doors.open(locker.buildingId, locker.bay) };
  }

  private locker(lockerId: string): Locker {
    const locker = this.lockerBank.byId(lockerId);
    if (locker === undefined) throw new LockerError(`no locker ${lockerId}`);
    return locker;
  }

  private known(buildingId: string): void {
    if (this.buildings.byId(buildingId) === undefined) throw new LockerError(`no building ${buildingId}`);
  }
}
