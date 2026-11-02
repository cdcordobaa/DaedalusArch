import type { DoorLatch } from '../../../application/ports/out/DoorLatch';
import type { LockBankDriver } from './LockBankDriver';

/** Pops a locker door by pulsing its bay on the building's LockBank hub. */
export class LockBankDoorLatch implements DoorLatch {
  constructor(private readonly lockbank: LockBankDriver) {}

  open(buildingId: string, bay: number): boolean {
    return this.lockbank.pulse({ hub: buildingId, bay, holdMs: 800 }).result === 'OPENED';
  }
}
