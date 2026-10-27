import { Patient } from '../domain/patient/Patient';
import { PatientRepository } from '../domain/patient/PatientRepository';

export class RegistrationService {
  constructor(private patients: PatientRepository) {}

  register(recordNumber: string, name: string): Patient {
    if (this.patients.findByRecordNumber(recordNumber)) {
      throw new Error('record number already registered');
    }
    const p = new Patient('p-' + recordNumber, recordNumber, name);
    this.patients.add(p);
    return p;
  }
}
