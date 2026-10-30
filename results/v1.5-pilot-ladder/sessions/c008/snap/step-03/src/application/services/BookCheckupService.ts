import type { Appointment } from '../../domain/model/Appointment';
import { CalendarRefused } from '../../domain/errors/CalendarRefused';
import { ClinicError } from '../../domain/errors/ClinicError';
import type { AppointmentView, BookCheckup, CheckupRequest, SlotView } from '../ports/in/BookCheckup';
import type { Appointments } from '../ports/out/Appointments';
import type { Calendar } from '../ports/out/Calendar';

export class BookCheckupService implements BookCheckup {
  /** Patients with a booking in flight, so two simultaneous requests cannot both pass the check. */
  private readonly booking = new Set<string>();

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
    if (this.booking.has(r.patientId) || (await this.appointments.hasForPatient(r.patientId))) {
      throw new ClinicError('You already have a check-up booked.');
    }
    this.booking.add(r.patientId);
    try {
      return await this.reserve(r);
    } finally {
      this.booking.delete(r.patientId);
    }
  }

  private async reserve(r: CheckupRequest): Promise<AppointmentView> {
    let reservationId: string;
    try {
      reservationId = await this.calendar.reserve(r.slotId, r.patientId);
    } catch (e) {
      if (e instanceof CalendarRefused && e.detail === 'SLOT_TAKEN') {
        const free = (await this.calendar.freeOn(r.day)).filter((s) => s.slotId !== r.slotId);
        return { status: 'taken', suggestion: free.length > 0 ? free[0].startsAt : null };
      }
      if (e instanceof CalendarRefused && e.detail === 'RATE_LIMITED') {
        return { status: 'try_later', retryIn: e.retryAfterSec ?? 30 };
      }
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
