import type { Appointment } from '../../../domain/appointment';

export interface AppointmentRepositoryPort {
  save(appointment: Appointment): Promise<void>;
  findById(id: string): Promise<Appointment | undefined>;
}
