import type { Appointment } from '../../domain/model/Appointment';
import { ClinicError } from '../../domain/errors/ClinicError';
import { CalendarBusy } from '../../domain/errors/CalendarBusy';
import { SlotTaken } from '../../domain/errors/SlotTaken';
import type { AppointmentView, BookCheckup, CheckupRequest, SlotView } from '../ports/in/BookCheckup';
import type { Appointments } from '../ports/out/Appointments';
import type { Calendar } from '../ports/out/Calendar';

export class BookCheckupService implements BookCheckup {
  private readonly inFlight = new Set<string>();

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
    if (this.inFlight.has(r.patientId) || (await this.appointments.existsForPatient(r.patientId))) {
      throw new ClinicError('You already have a check-up booked.');
    }
    this.inFlight.add(r.patientId);
    try {
      let reservationId: string;
      try {
        reservationId = await this.calendar.reserve(r.slotId, r.patientId);
      } catch (e) {
        if (e instanceof CalendarBusy) return { status: 'try_later', retryIn: e.retryInSec };
        if (!(e instanceof SlotTaken)) throw e;
        const left = (await this.calendar.freeOn(r.day)).filter((s) => s.slotId !== r.slotId);
        return { status: 'taken', suggestion: left.length > 0 ? left[0].startsAt : null };
      }
      const appointment: Appointment = { reservationId, patientId: r.patientId, slotId: r.slotId };
      await this.appointments.save(appointment);
      return { status: 'booked', reservationId, slotId: r.slotId };
    } finally {
      this.inFlight.delete(r.patientId);
    }
  }

  private day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ClinicError('a day is written YYYY-MM-DD');
    return day;
  }
}
