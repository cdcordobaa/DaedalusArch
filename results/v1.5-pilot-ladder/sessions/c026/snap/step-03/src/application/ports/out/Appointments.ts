import type { Appointment } from '../../../domain/model/Appointment';

export interface Appointments {
  existsForPatient(patientId: string): Promise<boolean>;
  save(appointment: Appointment): Promise<void>;
}
