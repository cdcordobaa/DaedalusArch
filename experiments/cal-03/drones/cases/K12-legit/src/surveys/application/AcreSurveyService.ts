import type { RequestSurveyCommand } from '../contracts/SurveyDto';
import type { SurveyService } from './SurveyService';

export interface AcreSurveyCommand extends Omit<RequestSurveyCommand, 'hectares'> {
  acres: number;
}

export class AcreSurveyService {
  constructor(private readonly surveys: SurveyService) {}

  requestInAcres(cmd: AcreSurveyCommand): string {
    const { acres, ...rest } = cmd;
    const hectares = acres * 0.404686;
    return this.surveys.requestSurvey({ ...rest, hectares });
  }
}
