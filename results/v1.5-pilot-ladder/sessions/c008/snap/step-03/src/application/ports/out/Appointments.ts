import type { Appointment } from '../../../domain/model/Appointment';

export interface Appointments {
  hasForPatient(patientId: string): Promise<boolean>;
  save(appointment: Appointment): Promise<void>;
}
