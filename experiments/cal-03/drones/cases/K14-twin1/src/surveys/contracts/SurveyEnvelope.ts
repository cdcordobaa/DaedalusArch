import type { SurveyDto } from './SurveyDto';

export interface SurveyEnvelope {
  survey: SurveyDto;
  generatedAt: Date;
}
