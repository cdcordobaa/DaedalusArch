import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotScheduleService {
  constructor(private readonly pilots: PilotRepository) {}

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
    return { ok: true };
  }
}
