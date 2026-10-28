import { SurveyRepository } from '../../surveys/domain/survey/SurveyRepository';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotBriefingService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly surveys: SurveyRepository,
  ) {}

  briefing(pilotId: string, surveyId: string): string {
    const pilot = this.pilots.findById(pilotId);
    const job = this.surveys.findById(surveyId);
    if (!pilot || !job) {
      throw new Error('unknown pilot or survey');
    }
    return `${pilot.name} flies ${job.siteName} (${job.area.hectares} ha)`;
  }
}
