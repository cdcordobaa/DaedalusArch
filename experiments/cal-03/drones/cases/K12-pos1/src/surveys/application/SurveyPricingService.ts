import type { SurveyRepository } from '../domain/survey/SurveyRepository';

export class SurveyPricingService {
  constructor(private readonly surveys: SurveyRepository) {}

  applyVolumeDiscount(id: string): void {
    const job = this.surveys.findById(id);
    if (!job) {
      throw new Error(`survey ${id} not found`);
    }
    const factor = job.area.hectares > 100 ? 0.9 : 1;
    const discounted = job.price.times(factor);
    job.applyPrice(discounted);
    this.surveys.save(job);
  }
}
