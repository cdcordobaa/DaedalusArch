import { Appointment } from '../domain/appointment/Appointment';
import { AppointmentRepository } from '../domain/appointment/AppointmentRepository';

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private rows = new Map<string, Appointment>();
  find(id: string): Appointment | undefined {
    return this.rows.get(id);
  }
  save(appt: Appointment): void {
    this.rows.set(appt.id, appt);
  }
}
