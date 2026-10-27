import type { AdopterStore } from '../../../application/ports/out/AdopterStore';
import type { Adopter } from '../../../domain/model/Adopter';

export class InMemoryAdopterStore implements AdopterStore {
  private readonly rows = new Map<string, Adopter>();

  nextId(): string {
    return `A-${String(this.rows.size + 1).padStart(4, '0')}`;
  }

  save(adopter: Adopter): void {
    this.rows.set(adopter.id, adopter);
  }

  byId(id: string): Adopter | undefined {
    return this.rows.get(id);
  }

  /** Every stored adopter, in id order. */
  all(): Adopter[] {
    return [...this.rows.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }
}
