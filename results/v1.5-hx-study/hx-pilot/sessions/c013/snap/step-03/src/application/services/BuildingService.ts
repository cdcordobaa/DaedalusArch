import { Building } from '../../domain/Building';
import { Locker } from '../../domain/Locker';
import { LockerError } from '../../domain/LockerError';
import { parseSize } from '../../domain/LockerSize';
import type { LockerLine, ManageBuildings } from '../ports/in/ManageBuildings';
import type { LatchFault, ReportLatchFaults } from '../ports/in/ReportLatchFaults';
import type { Buildings } from '../ports/out/Buildings';
import type { Lockers } from '../ports/out/Lockers';

export class BuildingService implements ManageBuildings, ReportLatchFaults {
  constructor(
    private readonly buildings: Buildings,
    private readonly lockerBank: Lockers,
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

  report(buildingId: string, bay: number, fault: LatchFault): { locker: string; inService: boolean } {
    const locker = this.lockerBank.inBuilding(buildingId).find((l) => l.bay === bay);
    if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
    if (fault === 'cleared') locker.returnToService();
    else locker.takeOutOfService();
    this.lockerBank.save(locker);
    return { locker: locker.id, inService: locker.inService };
  }

  private known(buildingId: string): void {
    if (this.buildings.byId(buildingId) === undefined) throw new LockerError(`no building ${buildingId}`);
  }
}
