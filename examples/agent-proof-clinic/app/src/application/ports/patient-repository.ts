import type { Patient } from "../../domain/patient.js";

export interface PatientRepository {
  save(patient: Patient): Promise<void>;
  findById(id: string): Promise<Patient | undefined>;
}
