import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/application';
import { FosterCarer, Placement } from '../../domain/foster';
import { AnimalRepository, ApplicationRepository, CarerRepository, PlacementRepository } from '../../ports/out/repositories';

export class InMemoryAnimalRepository implements AnimalRepository {
  private readonly items = new Map<string, Animal>();
  save(a: Animal): void { this.items.set(a.id, a); }
  get(id: string): Animal | undefined { return this.items.get(id); }
  list(): Animal[] { return [...this.items.values()]; }
}

export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly items = new Map<string, AdoptionApplication>();
  save(a: AdoptionApplication): void { this.items.set(a.id, a); }
  get(id: string): AdoptionApplication | undefined { return this.items.get(id); }
  byAnimal(animalId: string): AdoptionApplication[] { return [...this.items.values()].filter((a) => a.animalId === animalId); }
}

export class InMemoryCarerRepository implements CarerRepository {
  private readonly items = new Map<string, FosterCarer>();
  save(c: FosterCarer): void { this.items.set(c.id, c); }
  get(id: string): FosterCarer | undefined { return this.items.get(id); }
  list(): FosterCarer[] { return [...this.items.values()]; }
}

export class InMemoryPlacementRepository implements PlacementRepository {
  private readonly items = new Map<string, Placement>();
  save(p: Placement): void { this.items.set(p.id, p); }
  get(id: string): Placement | undefined { return this.items.get(id); }
  activeForCarer(carerId: string): Placement[] { return [...this.items.values()].filter((p) => p.carerId === carerId && !p.endedAt); }
  activeForAnimal(animalId: string): Placement | undefined { return [...this.items.values()].find((p) => p.animalId === animalId && !p.endedAt); }
}
