import { ClaimPhase } from '../domain/claim-phase';
import { RefillNotFoundError } from '../domain/errors';
import { RequestRefillCommand, RequestRefillPort, RequestRefillResult } from './ports/in/request-refill.port';
import { CoverageCheckPort } from './ports/out/coverage-check.port';
import { PatientNotifierPort } from './ports/out/patient-notifier.port';
import { RefillRepositoryPort } from './ports/out/refill-repository.port';

export class RequestRefillUseCase implements RequestRefillPort {
  constructor(
    private readonly refills: RefillRepositoryPort,
    private readonly coverage: CoverageCheckPort,
    private readonly notifier: PatientNotifierPort,
  ) {}

  async request(command: RequestRefillCommand): Promise<RequestRefillResult> {
    const refill = await this.refills.findById(command.refillId);
    if (refill === null) throw new RefillNotFoundError(command.refillId);
    const decision = await this.coverage.check({
      coverageId: refill.coverageId,
      productCode: refill.productCode,
      quantity: refill.quantity,
    });
    refill.applyCoverage(decision);
    await this.refills.save(refill);
    switch (decision.phase) {
      case ClaimPhase.Settled:
      case ClaimPhase.Captured:
      case ClaimPhase.AwaitingAuthorisation:
        await this.notifier.notifyRefill(refill.patientId, refill.id, refill.currentState);
        break;
      case ClaimPhase.Declined:
      case ClaimPhase.Withdrawn:
        break;
    }
    return { refillId: refill.id, state: refill.currentState, copayCents: refill.patientCopayCents };
  }
}
