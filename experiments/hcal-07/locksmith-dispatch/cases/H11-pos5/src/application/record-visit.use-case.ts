import { CallOutNotFoundError } from '../domain/errors';
import { RecordVisitCommand, RecordVisitPort } from './ports/in/record-visit.port';
import { CallOutRepositoryPort } from './ports/out/call-out-repository.port';
import { CustomerNotifierPort } from './ports/out/customer-notifier.port';

export class RecordVisitUseCase implements RecordVisitPort {
  constructor(
    private readonly callOuts: CallOutRepositoryPort,
    private readonly notifier: CustomerNotifierPort,
  ) {}

  async record(command: RecordVisitCommand): Promise<void> {
    const callOut = await this.callOuts.findByVisitRef(command.visitRef);
    if (callOut === null) throw new CallOutNotFoundError(command.visitRef);
    callOut.trackVisit(command.vendorState);
    callOut.recordProgress(command.progress);
    await this.callOuts.save(callOut);
    await this.notifier.notify(callOut.customerId, callOut.id, callOut.currentStatus);
  }
}
