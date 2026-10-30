import type { SterilisationRunStore } from '../../../../application/ports/out/admin/SterilisationRunStore';
import type { SterilisationRun } from '../../../../domain/model/admin/SterilisationRun';

export class InMemorySterilisationRunStore implements SterilisationRunStore {
  private readonly items: SterilisationRun[] = [];

  async add(item: SterilisationRun): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<SterilisationRun[]> {
    return [...this.items];
  }
}
