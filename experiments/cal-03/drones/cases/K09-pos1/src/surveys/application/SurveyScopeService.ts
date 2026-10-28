import type { SurveyRepository } from '../domain/survey/SurveyRepository';
import type { DeliverableKind } from '../domain/survey/value-objects/Deliverable';

export class SurveyScopeService {
  constructor(private readonly surveys: SurveyRepository) {}

  removeDeliverable(id: string, kind: DeliverableKind): void {
    const job = this.surveys.findById(id);
    if (!job) {
      throw new Error(`survey ${id} not found`);
    }
    if (job.deliverables.length <= 1) {
      throw new Error('a survey needs at least one deliverable');
    }
    job.removeDeliverable(kind);
    this.surveys.save(job);
  }
}
