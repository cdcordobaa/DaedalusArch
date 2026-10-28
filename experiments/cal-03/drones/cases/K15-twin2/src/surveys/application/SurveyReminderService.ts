import type { SurveyRepository } from '../domain/survey/SurveyRepository';
import type { ClientNotifier } from './ports/ClientNotifier';

export class SurveyReminderService {
  constructor(
    private readonly surveys: SurveyRepository,
    private readonly notifier: ClientNotifier,
  ) {}

  remind(id: string): void {
    const job = this.surveys.findById(id);
    if (!job) {
      throw new Error(`survey ${id} not found`);
    }
    this.notifier.notifyBooked(job.clientEmail, job.id);
  }
}
