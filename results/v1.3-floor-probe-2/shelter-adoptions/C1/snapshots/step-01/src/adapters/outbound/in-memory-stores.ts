import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/adoption-application';
import { AnimalStore, ApplicationStore } from '../../application/ports/outbound';

export class InMemoryAnimalStore implements AnimalStore {
  private readonly rows = new Map<string, Animal>();
  save(a: Animal): void { this.rows.set(a.id, a); }
  find(id: string): Animal | undefined { return this.rows.get(id); }
  all(): Animal[] { return [...this.rows.values()]; }
}

export class InMemoryApplicationStore implements ApplicationStore {
  private readonly rows = new Map<string, AdoptionApplication>();
  save(a: AdoptionApplication): void { this.rows.set(a.id, a); }
  find(id: string): AdoptionApplication | undefined { return this.rows.get(id); }
  forAnimal(animalId: string): AdoptionApplication[] { return [...this.rows.values()].filter((a) => a.animalId === animalId); }
}
