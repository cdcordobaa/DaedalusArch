import { Appointment } from '../domain/appointment';
import type { BookAppointmentCommand, BookAppointmentPort } from './ports/in/book-appointment.port';
import type { AppointmentRepositoryPort } from './ports/out/appointment-repository.port';
import type { OwnerNotifierPort } from './ports/out/owner-notifier.port';

let sequence = 0;

export class BookAppointmentUseCase implements BookAppointmentPort {
  constructor(
    private readonly appointments: AppointmentRepositoryPort,
    private readonly notifier: OwnerNotifierPort,
  ) {}

  async execute(command: BookAppointmentCommand): Promise<Appointment> {
    sequence += 1;
    const appointment = Appointment.schedule(`appt-${sequence}`, command.petId, command.ownerId, command.startsAt);
    await this.appointments.save(appointment);
    await this.notifier.notify(command.ownerId, `Appointment booked for ${command.startsAt.toISOString()}`);
    return appointment;
  }
}
