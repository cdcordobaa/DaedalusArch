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
    try {
      this.service.addDeliverable(id, kind, format);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'rejected' };
    }
  }

  get(id: string): SurveyDto {
    return this.service.getSurvey(id);
  }
}
