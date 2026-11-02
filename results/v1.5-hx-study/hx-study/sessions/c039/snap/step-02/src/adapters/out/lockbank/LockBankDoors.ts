import type { DoorOpener } from '../../../application/ports/out/DoorOpener';
import type { LockBankDriver } from './LockBankDriver';

/** Opens locker doors through the LockBank hub of the building (hub id = building id). */
export class LockBankDoors implements DoorOpener {
  constructor(private readonly driver: LockBankDriver) {}

  open(buildingId: string, bay: number): boolean {
    return this.driver.pulse({ hub: buildingId, bay, holdMs: 800 }).result === 'OPENED';
  }
}
