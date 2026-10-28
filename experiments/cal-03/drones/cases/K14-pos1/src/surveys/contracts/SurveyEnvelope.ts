import type { SurveyJob } from '../domain/survey/SurveyJob';

export interface SurveyEnvelope {
  survey: SurveyJob;
  generatedAt: Date;
}
