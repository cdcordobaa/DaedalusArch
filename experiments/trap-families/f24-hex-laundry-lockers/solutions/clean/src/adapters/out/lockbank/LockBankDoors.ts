import type { LockerDoors } from '../../../application/ports/out/LockerDoors';
import type { Locker } from '../../../domain/Locker';
import type { LockBankDriver } from './LockBankDriver';

/** Opens doors by pulsing the latch on the building's LockBank hub (the hub id is the building id). */
export class LockBankDoors implements LockerDoors {
  constructor(private readonly lockbank: LockBankDriver) {}

  open(locker: Locker): boolean {
    return this.lockbank.pulse({ hub: locker.buildingId, bay: locker.bay, holdMs: 800 }).result === 'OPENED';
  }
}
