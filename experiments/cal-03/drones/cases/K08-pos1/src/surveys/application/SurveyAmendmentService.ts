import type { SurveyRepository } from '../domain/survey/SurveyRepository';
import { Deliverable, DeliverableKind } from '../domain/survey/value-objects/Deliverable';

export class SurveyAmendmentService {
  constructor(private readonly surveys: SurveyRepository) {}

  addExtra(id: string, kind: DeliverableKind, format: string): void {
    const job = this.surveys.findById(id);
    if (!job) {
      throw new Error(`survey ${id} not found`);
    }
    if (job.deliverables.length >= 4) {
      throw new Error('a survey may hold at most four deliverables');
    }
    job.addDeliverable(new Deliverable(kind, format));
    this.surveys.save(job);
  }
}
