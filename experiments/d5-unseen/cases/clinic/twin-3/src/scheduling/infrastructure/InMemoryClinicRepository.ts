import { DoctorDay } from '../domain/doctorday/DoctorDay';
import { DoctorDayRepository } from '../domain/doctorday/DoctorDayRepository';
import { Appointment } from '../domain/appointment/Appointment';
import { AppointmentRepository } from '../domain/appointment/AppointmentRepository';

export class InMemoryDoctorDayRepository implements DoctorDayRepository {
  private rows = new Map<string, DoctorDay>();
  find(doctorId: string, date: string): DoctorDay | undefined {
    return this.rows.get(doctorId + '|' + date);
  }
  save(day: DoctorDay): void {
    this.rows.set(day.doctorId + '|' + day.date, day);
  }
}

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private rows = new Map<string, Appointment>();
  find(id: string): Appointment | undefined {
    return this.rows.get(id);
  }
  save(appt: Appointment): void {
    this.rows.set(appt.id, appt);
  }
}
