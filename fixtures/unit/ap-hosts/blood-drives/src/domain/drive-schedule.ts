import { DomainError } from './domain-error';

export class DriveFullError extends DomainError {
  constructor(driveId: string) {
    super('DRIVE_FULL', `Drive ${driveId} has no free bed at that time`);
  }
}

/** Opening hours and beds of a mobile drive; each bed takes one donor per slot. */
export class DriveSchedule {
  readonly opensAt: Date;
  readonly closesAt: Date;
  readonly beds: number;
  readonly slotMinutes: number;

  constructor(opensAt: Date, closesAt: Date, beds: number, slotMinutes: number) {
    this.opensAt = opensAt;
    this.closesAt = closesAt;
    this.beds = beds;
    this.slotMinutes = slotMinutes;
  }

  isSlotStart(at: Date): boolean {
    const offset = (at.getTime() - this.opensAt.getTime()) / 60_000;
    return offset >= 0 && at.getTime() < this.closesAt.getTime() && offset % this.slotMinutes === 0;
  }

  ensureBedFree(driveId: string, bookedInSlot: number): void {
    if (bookedInSlot >= this.beds) {
      throw new DriveFullError(driveId);
    }
  }

  capacity(): number {
    return Math.floor((this.closesAt.getTime() - this.opensAt.getTime()) / (this.slotMinutes * 60_000)) * this.beds;
  }
}
