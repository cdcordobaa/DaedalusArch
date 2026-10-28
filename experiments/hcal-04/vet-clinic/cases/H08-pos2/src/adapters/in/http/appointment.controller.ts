import type { BookAppointmentPort } from '../../../application/ports/in/book-appointment.port';
import type { CancelAppointmentPort } from '../../../application/ports/in/cancel-appointment.port';
import { ServiceRegistry } from '../../../application/service-registry';
import type { BookAppointmentRequestDto, CancelAppointmentRequestDto, HttpResponse } from './appointment.dto';

function bookingPort(): BookAppointmentPort {
  return ServiceRegistry.get<BookAppointmentPort>('book-appointment');
}

export class AppointmentController {
  constructor(private readonly cancelAppointment: CancelAppointmentPort) {}

  async book(body: BookAppointmentRequestDto): Promise<HttpResponse> {
    if (!body.petId || !body.ownerId || !body.startsAt) {
      return { status: 400, body: { error: 'missing field' } };
    }
    const startsAt = new Date(body.startsAt);
    try {
      const appointment = await bookingPort().execute({
        petId: body.petId,
        ownerId: body.ownerId,
        startsAt,
      });
      return { status: 201, body: { id: appointment.id, startsAt: appointment.startsAt.toISOString() } };
    } catch (error) {
      return { status: 500, body: { error: 'internal error' } };
    }
  }

  async cancel(body: CancelAppointmentRequestDto): Promise<HttpResponse> {
    if (!body.appointmentId) {
      return { status: 400, body: { error: 'missing field' } };
    }
    try {
      await this.cancelAppointment.execute({ appointmentId: body.appointmentId, now: new Date() });
      return { status: 204, body: {} };
    } catch (error) {
      return { status: 500, body: { error: 'internal error' } };
    }
  }
}
