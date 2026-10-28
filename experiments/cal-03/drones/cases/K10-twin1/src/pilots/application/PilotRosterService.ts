import type { EventBus } from '../../shared-kernel/EventBus';
import { PilotAssigned } from '../domain/events/PilotAssigned';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotRosterService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly bus: EventBus,
  ) {}

  assign(pilotId: string, surveyId: string, hours: number): { ok: boolean; reason?: string } {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      return { ok: false, reason: 'unknown pilot' };
    }
    try {
      pilot.assign(surveyId, hours);
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'rejected' };
    }
    this.pilots.save(pilot);
    this.bus.publish(new PilotAssigned(pilot.id, surveyId, hours));
    return { ok: true };
  }
}
