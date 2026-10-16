import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/adoption-application';
import { FosterCarer, FosterPlacement } from '../../domain/foster';
import { AnimalStore, ApplicationStore, CarerStore, PlacementStore } from '../../application/ports/outbound';

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

export class InMemoryCarerStore implements CarerStore {
  private readonly rows = new Map<string, FosterCarer>();
  save(c: FosterCarer): void { this.rows.set(c.id, c); }
  find(id: string): FosterCarer | undefined { return this.rows.get(id); }
  all(): FosterCarer[] { return [...this.rows.values()]; }
}

export class InMemoryPlacementStore implements PlacementStore {
  private readonly rows = new Map<string, FosterPlacement>();
  save(p: FosterPlacement): void { this.rows.set(p.id, p); }
  find(id: string): FosterPlacement | undefined { return this.rows.get(id); }
  activeFor(f: { animalId?: string; carerId?: string }): FosterPlacement[] {
    return [...this.rows.values()].filter((p) => p.active && (f.animalId === undefined || p.animalId === f.animalId) && (f.carerId === undefined || p.carerId === f.carerId));
  }
}
