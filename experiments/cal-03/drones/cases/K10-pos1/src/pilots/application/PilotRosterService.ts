import type { EventBus } from '../../shared-kernel/EventBus';
import { PilotAssigned } from '../domain/events/PilotAssigned';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotRosterService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly bus: EventBus,
  ) {}

  assign(pilotId: string, surveyId: string, hours: number): void {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      throw new Error('unknown pilot');
    }
    if (pilot.assignedHours + hours > pilot.weeklyHourCap) {
      throw new Error('weekly hour cap exceeded');
    }
    pilot.assign(surveyId, hours);
    this.pilots.save(pilot);
    this.bus.publish(new PilotAssigned(pilot.id, surveyId, hours));
  }
}
