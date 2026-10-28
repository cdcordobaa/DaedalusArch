import { newId } from '../../shared-kernel/ids';
import type { SurveyJob } from '../domain/survey/SurveyJob';
import type { SurveyRepository } from '../domain/survey/SurveyRepository';

export class InMemorySurveyRepository implements SurveyRepository {
  private readonly rows = new Map<string, SurveyJob>();

  nextId(): string {
    return newId('survey');
  }

  save(job: SurveyJob): void {
    this.rows.set(job.id, job);
  }

  findById(id: string): SurveyJob | undefined {
    return this.rows.get(id);
  }

  findAllBooked(): SurveyJob[] {
    return [...this.rows.values()].filter((job) => job.status === 'booked');
  }

  remove(id: string): void {
    this.rows.delete(id);
  }
}
