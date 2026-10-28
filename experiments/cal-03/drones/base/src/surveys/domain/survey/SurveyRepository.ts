import type { SurveyJob } from './SurveyJob';

export interface SurveyRepository {
  nextId(): string;
  save(job: SurveyJob): void;
  findById(id: string): SurveyJob | undefined;
}
