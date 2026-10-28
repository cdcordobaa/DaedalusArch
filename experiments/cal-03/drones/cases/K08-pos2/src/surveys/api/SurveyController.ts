import type { SurveyService } from '../application/SurveyService';
import type { DeliverableInput, RequestSurveyCommand, SurveyDto } from '../contracts/SurveyDto';

export class SurveyController {
  constructor(private readonly service: SurveyService) {}

  request(body: RequestSurveyCommand): { id: string } {
    return { id: this.service.requestSurvey(body) };
  }

  book(id: string): SurveyDto {
    this.service.bookSurvey(id);
    return this.service.getSurvey(id);
  }

  addDeliverable(id: string, kind: DeliverableInput['kind'], format: string): { ok: boolean; error?: string } {
    const survey = this.service.getSurvey(id);
    if (survey.pilotId !== null) {
      return { ok: false, error: 'scope is frozen once a pilot is assigned' };
    }
    this.service.addDeliverable(id, kind, format);
    return { ok: true };
  }

  get(id: string): SurveyDto {
    return this.service.getSurvey(id);
  }
}
