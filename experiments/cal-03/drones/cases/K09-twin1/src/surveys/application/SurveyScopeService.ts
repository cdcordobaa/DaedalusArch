import type { SurveyRepository } from '../domain/survey/SurveyRepository';
import type { DeliverableKind } from '../domain/survey/value-objects/Deliverable';

export class SurveyScopeService {
  constructor(private readonly surveys: SurveyRepository) {}

  removeDeliverable(id: string, kind: DeliverableKind): { ok: boolean; reason?: string } {
    const job = this.surveys.findById(id);
    if (!job) {
      throw new Error(`survey ${id} not found`);
    }
    try {
      job.removeDeliverable(kind);
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'rejected' };
    }
    this.surveys.save(job);
    return { ok: true };
  }
}
