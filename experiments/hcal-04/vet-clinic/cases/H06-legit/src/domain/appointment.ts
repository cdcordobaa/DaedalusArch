import { AppointmentNotCancellableError, ClinicClosedError, LateCancellationError } from './errors';

export type AppointmentStatus = 'scheduled' | 'cancelled' | 'completed';

const DAY_MS = 24 * 60 * 60 * 1000;

export class Appointment {
  private constructor(
    readonly id: string,
    readonly petId: string,
    readonly ownerId: string,
    readonly startsAt: Date,
    private status: AppointmentStatus,
  ) {}

  static schedule(id: string, petId: string, ownerId: string, startsAt: Date): Appointment {
    if (startsAt.getUTCDay() === 0) {
      throw new ClinicClosedError('clinic is closed on Sundays');
    }
    return new Appointment(id, petId, ownerId, startsAt, 'scheduled');
  }

  getStatus(): AppointmentStatus {
    return this.status;
  }

  cancel(now: Date): void {
    if (this.status !== 'scheduled') {
      throw new AppointmentNotCancellableError(`appointment ${this.id} is ${this.status}`);
    }
    if (this.startsAt.getTime() - now.getTime() < DAY_MS) {
      throw new LateCancellationError(`appointment ${this.id} starts within 24h`);
    }
    this.status = 'cancelled';
  }
}
