import type { SurveyRepository } from '../domain/survey/SurveyRepository';

export class SurveyPricingService {
  constructor(private readonly surveys: SurveyRepository) {}

  applyVolumeDiscount(id: string): void {
    const job = this.surveys.findById(id);
    if (!job) {
      throw new Error(`survey ${id} not found`);
    }
    job.applyVolumeDiscount();
    this.surveys.save(job);
  }
}
