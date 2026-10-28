import type { SurveyService } from './SurveyService';

export class SurveyReportService {
  constructor(private readonly surveys: SurveyService) {}

  summary(id: string): string {
    const survey = this.surveys.getSurvey(id);
    return `${survey.siteName}: ${survey.status}, ${survey.deliverables.length} deliverables`;
  }
}
