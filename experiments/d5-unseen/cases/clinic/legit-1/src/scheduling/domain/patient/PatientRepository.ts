import { Patient } from './Patient';

export interface PatientRepository {
  findByRecordNumber(recordNumber: string): Patient | undefined;
  add(p: Patient): void;
}
