import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class FlightLogService {
  constructor(private readonly pilots: PilotRepository) {}

  logCompletedSurvey(pilotId: string, surveyId: string): void {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      throw new Error('unknown pilot');
    }
    pilot.completeSurvey(surveyId);
    this.pilots.save(pilot);
  }
}
