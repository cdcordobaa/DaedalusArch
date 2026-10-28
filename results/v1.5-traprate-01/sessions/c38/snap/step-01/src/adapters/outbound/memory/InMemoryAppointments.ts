import type { Appointments } from '../../../application/ports/out/Appointments';
import type { Appointment } from '../../../domain/model/Appointment';

export class InMemoryAppointments implements Appointments {
  private readonly rows = new Map<string, Appointment>();
  private counter = 0;

  nextId(): string {
    this.counter += 1;
    return `APT-${String(this.counter)}`;
  }

  async save(appointment: Appointment): Promise<void> {
    this.rows.set(appointment.id, appointment);
  }

  async onDay(day: string): Promise<Appointment[]> {
    return [...this.rows.values()].filter((a) => a.day === day);
  }
}
