import { Patient } from '../domain/patient/Patient';
import { PatientRepository } from '../domain/patient/PatientRepository';

export class InMemoryPatientRepository implements PatientRepository {
  private byRecord = new Map<string, Patient>();
  findByRecordNumber(recordNumber: string): Patient | undefined {
    return this.byRecord.get(recordNumber);
  }
  add(p: Patient): void {
    this.byRecord.set(p.recordNumber, p);
  }
}
