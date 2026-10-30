import type { LockerDoors } from '../../../application/ports/out/LockerDoors';
import type { LockBankDriver } from './LockBankDriver';

/** Opens locker doors through the building's LockBank hub (the hub id is the building id). */
export class LockBankDoors implements LockerDoors {
  constructor(private readonly lockbank: LockBankDriver) {}

  open(buildingId: string, bay: number): boolean {
    return this.lockbank.pulse({ hub: buildingId, bay, holdMs: 800 }).result === 'OPENED';
  }
}
