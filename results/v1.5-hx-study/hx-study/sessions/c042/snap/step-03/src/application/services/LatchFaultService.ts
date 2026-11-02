import { LockerError } from '../../domain/LockerError';
import type { LatchFault, ReportLatchFaults } from '../ports/in/ReportLatchFaults';
import type { Lockers } from '../ports/out/Lockers';

export class LatchFaultService implements ReportLatchFaults {
  constructor(private readonly lockerBank: Lockers) {}

  report(buildingId: string, bay: number, fault: LatchFault): { locker: string; inService: boolean } {
    const locker = this.lockerBank.inBuilding(buildingId).find((l) => l.bay === bay);
    if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
    if (fault === 'cleared') locker.returnToService();
    else locker.takeOutOfService();
    this.lockerBank.save(locker);
    return { locker: locker.id, inService: locker.inService };
  }
}
