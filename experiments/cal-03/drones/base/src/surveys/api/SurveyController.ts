import type { SurveyService } from '../application/SurveyService';
import type { RequestSurveyCommand, SurveyDto } from '../contracts/SurveyDto';

export class SurveyController {
  constructor(private readonly service: SurveyService) {}

  request(body: RequestSurveyCommand): { id: string } {
    return { id: this.service.requestSurvey(body) };
  }

  book(id: string): SurveyDto {
    this.service.bookSurvey(id);
    return this.service.getSurvey(id);
  }

  get(id: string): SurveyDto {
    return this.service.getSurvey(id);
  }
}
