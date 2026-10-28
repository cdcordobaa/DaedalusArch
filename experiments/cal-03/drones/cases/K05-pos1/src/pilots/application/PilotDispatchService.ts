import type { SurveyService } from '../../surveys/index';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotDispatchService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly surveys: SurveyService,
  ) {}

  dispatch(pilotId: string, surveyId: string, hours: number): void {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      throw new Error('unknown pilot');
    }
    pilot.assign(surveyId, hours);
    this.pilots.save(pilot);
    this.surveys.recordPilot(surveyId, pilotId);
  }
}
