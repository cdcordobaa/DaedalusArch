import { Appointment } from '../appointment/Appointment';

export class DoctorDay {
  private appts: Appointment[] = [];
  constructor(readonly doctorId: string, readonly date: string) {}
  list(): readonly Appointment[] {
    return this.appts;
  }
  book(appt: Appointment): void {
    for (const a of this.appts) {
      if (a.start < appt.end && appt.start < a.end) {
        throw new Error('slot already taken');
      }
    }
    this.appts.push(appt);
  }
}
