import { Appointment } from './Appointment';

export interface AppointmentRepository {
  find(id: string): Appointment | undefined;
  save(appt: Appointment): void;
}
