import type { Appointment } from '../../../domain/model/Appointment';
import { ClinicError } from '../../../domain/errors/ClinicError';
import { BookingRefused } from '../../../domain/errors/BookingRefused';
import type { AppointmentView, BookCheckup, CheckupRequest, SlotView } from '../../ports/in/BookCheckup';
import type { Appointments } from '../../ports/out/storage/Appointments';
import type { Patients } from '../../ports/out/storage/Patients';
import type { Calendar } from '../../ports/out/calendar/Calendar';

export class BookCheckupService implements BookCheckup {
  constructor(
    private readonly calendar: Calendar,
    private readonly appointments: Appointments,
    private readonly patients: Patients,
  ) {}

  async freeSlots(day: string): Promise<SlotView[]> {
    return (await this.calendar.freeOn(this.day(day))).map((s) => ({ slotId: s.slotId, startsAt: s.startsAt, minutes: s.minutes }));
  }

  async book(r: CheckupRequest): Promise<AppointmentView> {
    this.day(r.day);
    if (r.patientId.trim() === '') throw new ClinicError('a patient is required');
    if (await this.patients.hasOpenBill(r.patientId)) throw new BookingRefused('OPEN_BILL', 'Please settle your open bill first.');
    const reservationId = await this.calendar.reserve(r.slotId, r.patientId);
    const appointment: Appointment = { reservationId, patientId: r.patientId, slotId: r.slotId };
    await this.appointments.save(appointment);
    return { status: 'booked', reservationId, slotId: r.slotId };
  }

  private day(day: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ClinicError('a day is written YYYY-MM-DD');
    return day;
  }
}
