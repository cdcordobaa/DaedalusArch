import { newId } from '../../shared-kernel/ids';
import type { FlightPermit } from '../domain/permit/FlightPermit';
import type { PermitRepository } from '../domain/permit/PermitRepository';

export class InMemoryPermitRepository implements PermitRepository {
  private readonly rows = new Map<string, FlightPermit>();

  nextId(): string {
    return newId('permit');
  }

  save(permit: FlightPermit): void {
    for (const other of this.rows.values()) {
      if (other.id !== permit.id && other.reference !== null && other.reference === permit.reference) {
        throw new Error('duplicate permit reference');
      }
    }
    this.rows.set(permit.id, permit);
  }

  findById(id: string): FlightPermit | undefined {
    return this.rows.get(id);
  }

  findBySurveyId(surveyId: string): FlightPermit | undefined {
    return [...this.rows.values()].find((p) => p.surveyId === surveyId);
  }
}
