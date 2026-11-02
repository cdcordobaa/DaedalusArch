import type { Doors } from '../../../application/ports/out/Doors';
import type { LockBankDriver } from './LockBankDriver';

/** Opens locker doors through the LockBank hub of the building (hub id = building id). */
export class LockBankDoors implements Doors {
  constructor(private readonly lockbank: LockBankDriver) {}

  open(buildingId: string, bay: number): boolean {
    return this.lockbank.pulse({ hub: buildingId, bay, holdMs: 800 }).result === 'OPENED';
  }
}
