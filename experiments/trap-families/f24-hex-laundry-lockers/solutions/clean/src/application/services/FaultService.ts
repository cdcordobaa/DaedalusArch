import { LockerError } from '../../domain/LockerError';
import type { LatchCondition, LockerFaults } from '../ports/in/LockerFaults';
import type { Lockers } from '../ports/out/Lockers';

/** A faulty latch takes its locker out of service; a sound one brings it back. A drop inside is left alone. */
export class FaultService implements LockerFaults {
  constructor(private readonly lockers: Lockers) {}

  report(buildingId: string, bay: number, condition: LatchCondition): { locker: string; inService: boolean } {
    const locker = this.lockers.atBay(buildingId, bay);
    if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
    if (condition === 'faulty') locker.takeOutOfService();
    else locker.returnToService();
    this.lockers.save(locker);
    return { locker: locker.id, inService: locker.inService };
  }
}
