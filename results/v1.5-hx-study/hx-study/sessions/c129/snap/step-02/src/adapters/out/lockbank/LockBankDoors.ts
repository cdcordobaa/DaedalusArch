import type { LockerDoors } from '../../../application/ports/out/LockerDoors';
import type { LockBankDriver } from './LockBankDriver';

/** Opens lockers through the building's LockBank hub (hub id = building id). */
export class LockBankDoors implements LockerDoors {
  constructor(private readonly driver: LockBankDriver) {}

  open(buildingId: string, bay: number): boolean {
    return this.driver.pulse({ hub: buildingId, bay, holdMs: 800 }).result === 'OPENED';
  }
}
