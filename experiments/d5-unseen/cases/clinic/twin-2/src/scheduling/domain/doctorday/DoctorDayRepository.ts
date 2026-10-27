import { DoctorDay } from './DoctorDay';

export interface DoctorDayRepository {
  find(doctorId: string, date: string): DoctorDay | undefined;
  save(day: DoctorDay): void;
}
