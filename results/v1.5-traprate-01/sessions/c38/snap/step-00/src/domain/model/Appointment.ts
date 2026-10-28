import { ClinicError } from '../errors/ClinicError';
import type { PhoneNumber } from './PhoneNumber';

/** A patient's appointment at the clinic, on a day (YYYY-MM-DD) at a time (HH:MM). */
export class Appointment {
  private reminderTextId: string | undefined;

  private constructor(
    readonly id: string,
    readonly patientName: string,
    readonly phone: PhoneNumber,
    readonly day: string,
    readonly time: string,
  ) {}

  static book(id: string, patientName: string, phone: PhoneNumber, day: string, time: string): Appointment {
    if (patientName.trim() === '') throw new ClinicError('patient name is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ClinicError('day must be YYYY-MM-DD');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ClinicError('time must be HH:MM');
    return new Appointment(id, patientName.trim(), phone, day, time);
  }

  /** The text that reminded the patient, once it was sent. */
  get reminder(): string | undefined {
    return this.reminderTextId;
  }

  remindedBy(textId: string): void {
    this.reminderTextId = textId;
  }
}
