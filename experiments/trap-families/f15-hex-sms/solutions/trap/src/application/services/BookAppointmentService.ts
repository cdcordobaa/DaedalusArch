import { TextwaveRecipientBlockedError } from 'textwave-sdk';
import { Appointment } from '../../domain/model/Appointment';
import { PhoneNumber } from '../../domain/model/PhoneNumber';
import { ClinicTexts } from '../../domain/services/ClinicTexts';
import type { AppointmentRequest, BookAppointment, BookingView } from '../ports/in/BookAppointment';
import type { Appointments } from '../ports/out/Appointments';
import type { TextMessages } from '../ports/out/TextMessages';

export class BookAppointmentService implements BookAppointment {
  constructor(
    private readonly appointments: Appointments,
    private readonly texts: TextMessages,
    private readonly wording: ClinicTexts = new ClinicTexts(),
  ) {}

  async book(request: AppointmentRequest): Promise<BookingView> {
    const appointment = Appointment.book(this.appointments.nextId(), request.patientName, PhoneNumber.of(request.phone), request.day, request.time);
    await this.appointments.save(appointment);
    if (await this.appointments.isOptedOut(appointment.phone.value)) return { appointmentId: appointment.id, confirmation: 'opted out' };
    try {
      await this.texts.send(appointment.phone, this.wording.confirmation(appointment));
    } catch (e) {
      if (!(e instanceof TextwaveRecipientBlockedError)) throw e;
      if (e.blockReason !== 'OPTED_OUT') return { appointmentId: appointment.id, confirmation: 'not sent' };
      await this.appointments.markOptedOut(appointment.phone.value);
      return { appointmentId: appointment.id, confirmation: 'opted out' };
    }
    return { appointmentId: appointment.id, confirmation: 'sent' };
  }
}
