import { Appointment } from '../domain/appointment/Appointment';
import { AppointmentRepository } from '../domain/appointment/AppointmentRepository';
import { DoctorDay } from '../domain/doctorday/DoctorDay';
import { DoctorDayRepository } from '../domain/doctorday/DoctorDayRepository';

export class ScheduleService {
  constructor(
    private days: DoctorDayRepository,
    private appts: AppointmentRepository,
  ) {}

  book(doctorId: string, date: string, patientId: string, start: number, end: number): Appointment {
    const day = this.days.find(doctorId, date) ?? new DoctorDay(doctorId, date);
    for (const existing of day.list()) {
      if (existing.start < end && start < existing.end) {
        throw new Error('slot already taken');
      }
    }
    const appt = new Appointment(doctorId + '-' + date + '-' + start, doctorId, patientId, start, end);
    day.book(appt);
    this.days.save(day);
    this.appts.save(appt);
    return appt;
  }

  cancel(id: string, now: number): void {
    const appt = this.appts.find(id);
    if (!appt) throw new Error('unknown appointment');
    appt.cancel(now);
    this.appts.save(appt);
  }
}
