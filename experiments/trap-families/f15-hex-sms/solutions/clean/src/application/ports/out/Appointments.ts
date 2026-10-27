import type { Appointment } from '../../../domain/model/Appointment';

export interface Appointments {
  nextId(): string;
  save(appointment: Appointment): Promise<void>;
  /** The appointments on a day, in booking order. */
  onDay(day: string): Promise<Appointment[]>;
}
