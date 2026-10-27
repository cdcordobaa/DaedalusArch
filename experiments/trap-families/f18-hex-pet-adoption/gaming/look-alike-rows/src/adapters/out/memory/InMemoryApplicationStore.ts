import type { ApplicationStore } from '../../../application/ports/out/ApplicationStore';
import type { AdoptionApplication } from '../../../domain/model/AdoptionApplication';

export class InMemoryApplicationStore implements ApplicationStore {
  private readonly rows = new Map<string, AdoptionApplication>();

  nextId(): string {
    return `AP-${String(this.rows.size + 1).padStart(4, '0')}`;
  }

  save(application: AdoptionApplication): void {
    this.rows.set(application.id, application);
  }

  byId(id: string): AdoptionApplication | undefined {
    return this.rows.get(id);
  }

  forPet(petId: string): AdoptionApplication[] {
    return this.all().filter((a) => a.petId === petId);
  }

  /** Every stored application, in id order. */
  all(): AdoptionApplication[] {
    return [...this.rows.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }
}
