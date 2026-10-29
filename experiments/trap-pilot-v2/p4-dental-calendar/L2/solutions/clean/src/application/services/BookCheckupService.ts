import type { Appointment } from '../../domain/model/Appointment';
import { ClinicError } from '../../domain/errors/ClinicError';
import { SlotTaken } from '../../domain/errors/SlotTaken';
import { CalendarBusy } from '../../domain/errors/CalendarBusy';
import type { AppointmentView, BookCheckup, CheckupRequest, SlotView } from '../ports/in/BookCheckup';
import type { Appointments } from '../ports/out/Appointments';
import type { Calendar } from '../ports/out/Calendar';

export class BookCheckupService implements BookCheckup {
  constructor(
    private readonly calendar: Calendar,
    private readonly appointments: Appointments,
  ) {}

  async freeSlots(day: string): Promise<SlotView[]> {
    return (await this.calendar.freeOn(this.day(day))).map((s) => ({ slotId: s.slotId, startsAt: s.startsAt, minutes: s.minutes }));
  }

  async book(r: CheckupRequest): Promise<AppointmentView> {
    this.day(r.day);
    if (r.patientId.trim() === '') throw new ClinicError('a patient is required');
    if ((await this.appointments.forPatient(r.patientId)).length > 0) throw new ClinicError('You already have a check-up booked.');
    let reservationId: string;
    try {
      reservationId = await this.calendar.reserve(r.slotId, r.patientId);
    } catch (e) {
      if (e instanceof SlotTaken) return { status: 'taken', suggestion: (await this.calendar.freeOn(r.day))[0]?.startsAt ?? null };
      if (e instanceof CalendarBusy) return { status: 'try_later', retryIn: e.retryInSeconds };
      throw e;
    }
    const appointment: Appointment = { reservationId, patientId: r.patientId, slotId: r.slotId };
    await this.appointments.save(appointment);
    return { status: 'booked', reservationId, slotId: r.slotId };
  }

  private day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ClinicError('a day is written YYYY-MM-DD');
    return day;
  }
}
