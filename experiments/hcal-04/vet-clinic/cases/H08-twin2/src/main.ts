import { AppointmentController } from './adapters/in/http/appointment.controller';
import { ClaimController } from './adapters/in/http/claim.controller';
import { PetClaimsGateway } from './adapters/out/claims/petclaim-claims.gateway';
import { ConsoleOwnerNotifier } from './adapters/out/notification/console-owner-notifier';
import { InMemoryAppointmentRepository } from './adapters/out/persistence/in-memory-appointment.repository';
import { InMemoryInvoiceRepository } from './adapters/out/persistence/in-memory-invoice.repository';
import { BookAppointmentUseCase } from './application/book-appointment.use-case';
import { CancelAppointmentUseCase } from './application/cancel-appointment.use-case';
import type { NotifyChannel } from './application/submit-claim.use-case';
import type { OwnerNotifierPort } from './application/ports/out/owner-notifier.port';
import { SubmitClaimUseCase } from './application/submit-claim.use-case';

const appointments = new InMemoryAppointmentRepository();
const invoices = new InMemoryInvoiceRepository();
const notifier = new ConsoleOwnerNotifier();
const claims = new PetClaimsGateway('demo-key');

const channels = new Map<NotifyChannel, OwnerNotifierPort>([
  ['email', notifier],
  ['sms', notifier],
]);

export const appointmentController = new AppointmentController(
  new BookAppointmentUseCase(appointments, notifier),
  new CancelAppointmentUseCase(appointments, notifier),
);
export const claimController = new ClaimController(new SubmitClaimUseCase(invoices, claims, channels));
