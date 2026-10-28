import type { SurveyDto } from '../../surveys/contracts/SurveyDto';
import type { PermitService } from '../application/PermitService';

export class PermitSurveyController {
  constructor(
    private readonly permits: PermitService,
    private readonly lookupSurvey: (surveyId: string) => SurveyDto,
  ) {}

  describe(permitId: string): string {
    const permit = this.permits.getPermit(permitId);
    const survey = this.lookupSurvey(permit.surveyId);
    return `${permit.status} for ${survey.siteName}`;
  }
}
