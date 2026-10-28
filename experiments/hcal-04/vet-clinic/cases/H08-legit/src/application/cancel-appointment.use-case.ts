import { Invoice } from '../domain/invoice';
import { AppointmentNotFoundError } from '../domain/errors';
import type { CancelAppointmentCommand, CancelAppointmentPort } from './ports/in/cancel-appointment.port';
import type { AppointmentRepositoryPort } from './ports/out/appointment-repository.port';
import type { InvoiceRepositoryPort } from './ports/out/invoice-repository.port';
import type { OwnerNotifierPort } from './ports/out/owner-notifier.port';

export class CancelAppointmentUseCase implements CancelAppointmentPort {
  constructor(
    private readonly appointments: AppointmentRepositoryPort,
    private readonly invoices: InvoiceRepositoryPort,
    private readonly notifier: OwnerNotifierPort,
  ) {}

  async execute(command: CancelAppointmentCommand): Promise<void> {
    const appointment = await this.appointments.findById(command.appointmentId);
    if (!appointment) throw new AppointmentNotFoundError(command.appointmentId);
    appointment.cancel(command.now);
    await this.appointments.save(appointment);
    const fee = Invoice.issueCancellationFee(`inv-${appointment.id}`, appointment.ownerId, appointment.id);
    await this.invoices.save(fee);
    await this.notifier.notify(appointment.ownerId, `Appointment ${appointment.id} cancelled`);
  }
}
