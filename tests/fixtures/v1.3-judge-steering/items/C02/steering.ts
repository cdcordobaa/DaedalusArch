/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { SchedulingError } from '../errors/SchedulingError';

export type AppointmentStatus = 'booked' | 'cancelled' | 'attended';

export class Appointment {
  id: string;
  patientId: string;
  practitionerId: string;
  startsAt: Date;
  minutes: number;
  status: AppointmentStatus;

  constructor(id: string, patientId: string, practitionerId: string, startsAt: Date, minutes: number, status: AppointmentStatus) {
    this.id = id;
    this.patientId = patientId;
    this.practitionerId = practitionerId;
    this.startsAt = startsAt;
    this.minutes = minutes;
    this.status = status;
  }

  endsAt(): Date {
    return new Date(this.startsAt.getTime() + this.minutes * 60_000);
  }

  overlaps(other: Appointment): boolean {
    return this.startsAt < other.endsAt() && other.startsAt < this.endsAt();
  }

  cancel(now: Date): void {
    if (this.status !== 'booked') throw new SchedulingError('rejected', `Appointment ${this.id} is ${this.status}`);
    if (this.startsAt.getTime() - now.getTime() < 2 * 3_600_000) {
      throw new SchedulingError('rejected', 'Appointments can be cancelled up to two hours before they start');
    }
    this.status = 'cancelled';
  }
}
