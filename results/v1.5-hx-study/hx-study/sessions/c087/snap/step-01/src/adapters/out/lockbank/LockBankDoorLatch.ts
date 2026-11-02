import type { DoorLatch } from '../../../application/ports/out/DoorLatch';
import type { LockBankDriver } from './LockBankDriver';

/** Opens locker doors through the LockBank hub, holding the latch 800 ms. */
export class LockBankDoorLatch implements DoorLatch {
  constructor(private readonly driver: LockBankDriver) {}

  open(buildingId: string, bay: number): boolean {
    return this.driver.pulse({ hub: buildingId, bay, holdMs: 800 }).result === 'OPENED';
  }
}
