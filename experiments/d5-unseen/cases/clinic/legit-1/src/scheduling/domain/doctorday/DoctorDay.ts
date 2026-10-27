import { Appointment } from '../appointment/Appointment';

export class DoctorDay {
  private appts: Appointment[] = [];
  constructor(readonly doctorId: string, readonly date: string) {}
  list(): readonly Appointment[] {
    return this.appts;
  }
  book(appt: Appointment): void {
    const clash = this.appts.some(
      (a) => !a.isCancelled() && Math.max(a.start, appt.start) < Math.min(a.end, appt.end),
    );
    if (clash) throw new Error('doctor is busy');
    this.appts.push(appt);
  }
}
