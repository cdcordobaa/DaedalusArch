import type { Appointment } from '../../../domain/model/Appointment';
import type { Appointments } from '../../../application/ports/out/Appointments';

export class InMemoryAppointments implements Appointments {
  private readonly rows: Appointment[] = [];

  async hasPatient(patientId: string): Promise<boolean> {
    return this.rows.some((a) => a.patientId === patientId);
  }

  async save(appointment: Appointment): Promise<void> {
    this.rows.push(appointment);
  }
}
