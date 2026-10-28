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
    await this.texts.send(appointment.phone, this.wording.confirmation(appointment));
    return { appointmentId: appointment.id, confirmation: 'sent' };
  }
}
