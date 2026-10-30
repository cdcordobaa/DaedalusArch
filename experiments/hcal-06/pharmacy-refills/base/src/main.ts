import { RefillController } from './adapters/in/http/refill.controller';
import { RxClaimCoverageGateway } from './adapters/out/claims/rxclaim-coverage.gateway';
import { ConsolePatientNotifier } from './adapters/out/notification/console-patient-notifier';
import { InMemoryRefillRepository } from './adapters/out/persistence/in-memory-refill.repository';
import { RequestRefillUseCase } from './application/request-refill.use-case';

const requestRefill = new RequestRefillUseCase(
  new InMemoryRefillRepository(),
  new RxClaimCoverageGateway('demo-key', '610014'),
  new ConsolePatientNotifier(),
);
export const refillController = new RefillController(requestRefill);
