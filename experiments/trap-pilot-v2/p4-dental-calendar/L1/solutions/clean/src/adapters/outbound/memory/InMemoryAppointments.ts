import type { Appointment } from '../../../domain/model/Appointment';
import type { Appointments } from '../../../application/ports/out/Appointments';

export class InMemoryAppointments implements Appointments {
  private readonly rows: Appointment[] = [];

  async save(appointment: Appointment): Promise<void> {
    this.rows.push(appointment);
  }

  async forPatient(patientId: string): Promise<Appointment[]> {
    return this.rows.filter((a) => a.patientId === patientId);
  }
}
