import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class GuardedPilotService {
  constructor(private readonly pilots: PilotRepository) {}

  assign(pilotId: string, surveyId: string, hours: number): void {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      throw new Error('unknown pilot');
    }
    try {
      pilot.assign(surveyId, hours);
    } catch (error) {
      if (error instanceof Error && error.message === 'pilot already assigned to this survey') {
        return;
      }
      throw error;
    }
    this.pilots.save(pilot);
  }
}
