import type { Appointment } from '../../../domain/appointment';
import type { AppointmentRepositoryPort } from '../../../application/ports/out/appointment-repository.port';

export class InMemoryAppointmentRepository implements AppointmentRepositoryPort {
  private readonly items = new Map<string, Appointment>();

  async save(appointment: Appointment): Promise<void> {
    this.items.set(appointment.id, appointment);
  }

  async findById(id: string): Promise<Appointment | undefined> {
    return this.items.get(id);
  }
}
