import { HttpError } from 'http-kit';
import { CallOutNotFoundError } from '../domain/errors';
import { DispatchCallOutCommand, DispatchCallOutPort, DispatchCallOutResult } from './ports/in/dispatch-call-out.port';
import { CallOutRepositoryPort } from './ports/out/call-out-repository.port';
import { CustomerNotifierPort } from './ports/out/customer-notifier.port';
import { TechnicianSchedulingPort } from './ports/out/technician-scheduling.port';

export class DispatchCallOutUseCase implements DispatchCallOutPort {
  constructor(
    private readonly callOuts: CallOutRepositoryPort,
    private readonly scheduling: TechnicianSchedulingPort,
    private readonly notifier: CustomerNotifierPort,
  ) {}

  async dispatch(command: DispatchCallOutCommand): Promise<DispatchCallOutResult> {
    const callOut = await this.callOuts.findById(command.callOutId);
    if (callOut === null) throw new CallOutNotFoundError(command.callOutId);
    if (callOut.currentStatus !== 'REQUESTED') throw new HttpError(409, `call-out ${callOut.id} is already dispatched`);
    const assignment = await this.scheduling.request({
      district: callOut.district,
      lockType: callOut.lockType,
      urgency: callOut.urgency,
      earliestStart: new Date().toISOString(),
    });
    callOut.schedule(assignment);
    await this.callOuts.save(callOut);
    await this.notifier.notify(callOut.customerId, callOut.id, callOut.currentStatus);
    return { callOutId: callOut.id, status: callOut.currentStatus, minutesToArrival: assignment.minutesToArrival };
  }
}
