import type { Pilot } from '../domain/pilot/Pilot';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class FlightLogService {
  constructor(private readonly pilots: PilotRepository) {}

  logCompletedSurvey(pilotId: string, surveyId: string): void {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      throw new Error('unknown pilot');
    }
    pilot.logFlight(this.flownHours(pilot, surveyId));
    pilot.release(surveyId);
    this.pilots.save(pilot);
  }

  private flownHours(pilot: Pilot, surveyId: string): number {
    const planned = pilot.assignments.find((a) => a.surveyId === surveyId);
    if (!planned) {
      throw new Error('survey was not assigned to this pilot');
    }
    return planned.hours * 0.9 + (pilot.assignedHours > 30 ? 0.5 : 0);
  }
}
