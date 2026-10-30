import type { Appointment } from '../../domain/model/Appointment';
import { ClinicError } from '../../domain/errors/ClinicError';
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
    const result = await this.calendar.reserve(r.slotId, r.patientId);
    if (result.taken) {
      const left = (await this.calendar.freeOn(r.day)).filter((s) => s.slotId !== r.slotId);
      return { status: 'taken', suggestion: left[0]?.startsAt ?? null };
    }
    if ('retryIn' in result) return { status: 'try_later', retryIn: result.retryIn };
    const reservationId = result.reservationId;
    const appointment: Appointment = { reservationId, patientId: r.patientId, slotId: r.slotId };
    await this.appointments.save(appointment);
    return { status: 'booked', reservationId, slotId: r.slotId };
  }

  private day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ClinicError('a day is written YYYY-MM-DD');
    return day;
  }
}
