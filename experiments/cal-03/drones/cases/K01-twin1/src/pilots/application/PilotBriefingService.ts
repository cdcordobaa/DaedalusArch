import type { SurveyService } from '../../surveys/index';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotBriefingService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly surveys: SurveyService,
  ) {}

  briefing(pilotId: string, surveyId: string): string {
    const pilot = this.pilots.findById(pilotId);
    const survey = this.surveys.getSurvey(surveyId);
    if (!pilot) {
      throw new Error('unknown pilot');
    }
    return `${pilot.name} flies ${survey.siteName} (${survey.hectares} ha)`;
  }
}
