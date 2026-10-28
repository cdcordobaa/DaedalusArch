import { newId } from '../../shared-kernel/ids';
import type { Pilot } from '../domain/pilot/Pilot';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class InMemoryPilotRepository implements PilotRepository {
  private readonly rows = new Map<string, Pilot>();

  nextId(): string {
    return newId('pilot');
  }

  save(pilot: Pilot): void {
    this.rows.set(pilot.id, pilot);
  }

  findById(id: string): Pilot | undefined {
    return this.rows.get(id);
  }

  findByLicence(licenceNo: string): Pilot | undefined {
    return [...this.rows.values()].find((p) => p.licenceNo === licenceNo);
  }

  findAll(): Pilot[] {
    return [...this.rows.values()];
  }
}
