import { newId } from '../../shared-kernel/ids';
import type { Pilot } from '../domain/pilot/Pilot';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class InMemoryPilotRepository implements PilotRepository {
  private readonly rows = new Map<string, Pilot>();
  private readonly assignmentRows = new Map<string, string[]>();

  nextId(): string {
    return newId('pilot');
  }

  save(pilot: Pilot): void {
    this.rows.set(pilot.id, pilot);
    this.assignmentRows.set(pilot.id, pilot.assignments.map((a) => a.surveyId));
  }

  findById(id: string): Pilot | undefined {
    return this.rows.get(id);
  }

  findAll(): Pilot[] {
    return [...this.rows.values()];
  }
}
