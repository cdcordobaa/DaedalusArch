import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotScheduleService {
  constructor(private readonly pilots: PilotRepository) {}

  assign(pilotId: string, surveyId: string, hours: number): { ok: boolean; reason?: string } {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      return { ok: false, reason: 'unknown pilot' };
    }
    const alreadyAssigned = pilot.assignments.some((a) => a.surveyId === surveyId);
    if (alreadyAssigned) {
      return { ok: false, reason: 'already assigned' };
    }
    pilot.assign(surveyId, hours);
    this.pilots.save(pilot);
    return { ok: true };
  }
}
