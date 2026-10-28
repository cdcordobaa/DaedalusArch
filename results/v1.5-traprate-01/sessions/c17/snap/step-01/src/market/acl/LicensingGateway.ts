import type { LicensingDesk } from '../../licensing';
import type { LicenceRegister, LicenceStatus } from '../application/ports/LicenceRegister';

/** Asks the licensing desk, through what it publishes, and answers in the terms pitch bookings use. */
export class LicensingGateway implements LicenceRegister {
  constructor(private readonly desk: LicensingDesk) {}

  isRegistered(vendorId: string): boolean {
    return this.desk.sheet(vendorId) !== undefined;
  }

  statusOf(vendorId: string): LicenceStatus | undefined {
    return this.desk.sheet(vendorId)?.status;
  }
}
