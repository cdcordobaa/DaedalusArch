import type { SurveyService } from '../../surveys/application/SurveyService';
import type { PermitService } from '../application/PermitService';

export class PermitSurveyController {
  constructor(
    private readonly permits: PermitService,
    private readonly surveys: SurveyService,
  ) {}

  describe(permitId: string): string {
    const permit = this.permits.getPermit(permitId);
    const survey = this.surveys.getSurvey(permit.surveyId);
    return `${permit.status} for ${survey.siteName}`;
  }
}
