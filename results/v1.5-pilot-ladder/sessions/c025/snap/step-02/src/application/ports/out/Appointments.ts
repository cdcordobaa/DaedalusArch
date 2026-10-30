import type { Appointment } from '../../../domain/model/Appointment';

export interface Appointments {
  save(appointment: Appointment): Promise<void>;
}
