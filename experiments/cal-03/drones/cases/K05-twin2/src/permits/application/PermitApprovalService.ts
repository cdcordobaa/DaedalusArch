import type { SurveyService } from '../../surveys/index';
import type { PermitRepository } from '../domain/permit/PermitRepository';
import type { AirspaceAuthority } from './ports/AirspaceAuthority';

export class PermitApprovalService {
  constructor(
    private readonly permits: PermitRepository,
    private readonly authority: AirspaceAuthority,
    private readonly surveys: SurveyService,
  ) {}

  async approve(permitId: string): Promise<void> {
    const permit = this.permits.findById(permitId);
    if (!permit) {
      throw new Error('unknown permit');
    }
    const survey = this.surveys.getSurvey(permit.surveyId);
    if (survey.status !== 'booked') {
      permit.deny('survey is not booked');
      this.permits.save(permit);
      return;
    }
    const reference = this.authority.requestClearance(permit.surveyId, permit.window.start, permit.window.end);
    permit.grant(reference);
    this.permits.save(permit);
    await Promise.resolve();
  }
}
