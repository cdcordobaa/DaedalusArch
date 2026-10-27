import { CancellationService } from './scheduling/application/CancellationService';
import { InMemoryAppointmentRepository } from './scheduling/infrastructure/InMemoryAppointmentRepository';

export const cancellation = new CancellationService(new InMemoryAppointmentRepository());
