import type { EventBus } from '../../shared-kernel/EventBus';
import { AssignmentTransferred } from '../domain/events/AssignmentTransferred';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotTransferService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly bus: EventBus,
  ) {}

  transfer(fromId: string, toId: string, surveyId: string, hours: number): void {
    const to = this.pilots.findById(toId);
    if (!to) {
      throw new Error('unknown pilot');
    }
    to.assign(surveyId, hours);
    this.pilots.save(to);
    this.bus.publish(new AssignmentTransferred(fromId, surveyId));
  }

  onTransferred(event: AssignmentTransferred): void {
    const from = this.pilots.findById(event.fromPilotId);
    if (!from) {
      throw new Error('unknown pilot');
    }
    from.release(event.surveyId);
    this.pilots.save(from);
  }
}
