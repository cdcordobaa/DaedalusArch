import { Appointment } from '../appointment/Appointment';

export class DoctorDay {
  private appts: Appointment[] = [];
  constructor(readonly doctorId: string, readonly date: string) {}
  list(): readonly Appointment[] {
    return this.appts;
  }
  book(appt: Appointment): void {
    this.appts.push(appt);
  }
}
