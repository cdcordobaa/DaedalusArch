import type { PatientRepository } from "../../application/ports/patient-repository.js";
import type { Patient } from "../../domain/patient.js";

export class InMemoryPatientRepository implements PatientRepository {
  private readonly byId = new Map<string, Patient>();

  async save(patient: Patient): Promise<void> {
    this.byId.set(patient.id, patient);
  }

  async findById(id: string): Promise<Patient | undefined> {
    return this.byId.get(id);
  }
}
