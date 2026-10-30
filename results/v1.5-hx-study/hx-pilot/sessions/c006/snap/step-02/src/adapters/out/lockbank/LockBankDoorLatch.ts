import type { DoorLatch } from '../../../application/ports/out/DoorLatch';
import type { LockBankDriver } from './LockBankDriver';

/** Opens locker doors through the LockBank hub of the building (the hub id is the building id). */
export class LockBankDoorLatch implements DoorLatch {
  constructor(private readonly lockbank: LockBankDriver) {}

  open(buildingId: string, bay: number): boolean {
    return this.lockbank.pulse({ hub: buildingId, bay, holdMs: 800 }).result === 'OPENED';
  }
}
