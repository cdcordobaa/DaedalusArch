import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotScheduleService {
  constructor(private readonly pilots: PilotRepository) {}

  assign(pilotId: string, surveyId: string, hours: number): { ok: boolean; reason?: string } {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      return { ok: false, reason: 'unknown pilot' };
    }
    if (!pilot.canAssign(surveyId, hours)) {
      return { ok: false, reason: 'assignment rejected' };
    }
    pilot.assign(surveyId, hours);
    this.pilots.save(pilot);
    return { ok: true };
  }
}
