import { AppointmentController } from './adapters/in/http/appointment.controller';
import { ClaimController } from './adapters/in/http/claim.controller';
import { PetClaimsGateway } from './adapters/out/claims/petclaim-claims.gateway';
import { ConsoleOwnerNotifier } from './adapters/out/notification/console-owner-notifier';
import { InMemoryAppointmentRepository } from './adapters/out/persistence/in-memory-appointment.repository';
import { InMemoryInvoiceRepository } from './adapters/out/persistence/in-memory-invoice.repository';
import { BookAppointmentUseCase } from './application/book-appointment.use-case';
import { CancelAppointmentUseCase } from './application/cancel-appointment.use-case';
import { SubmitClaimUseCase } from './application/submit-claim.use-case';
import { ServiceRegistry } from './application/service-registry';

const appointments = new InMemoryAppointmentRepository();
const invoices = new InMemoryInvoiceRepository();
const notifier = new ConsoleOwnerNotifier();
const claims = new PetClaimsGateway('demo-key');

ServiceRegistry.register('book-appointment', new BookAppointmentUseCase(appointments, notifier));

export const appointmentController = new AppointmentController(
  new CancelAppointmentUseCase(appointments, notifier),
);
export const claimController = new ClaimController(new SubmitClaimUseCase(invoices, claims, notifier));
