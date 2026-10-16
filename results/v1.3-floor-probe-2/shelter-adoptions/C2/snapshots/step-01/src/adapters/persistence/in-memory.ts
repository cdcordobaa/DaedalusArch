import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/application';
import { AnimalRepository, ApplicationRepository } from '../../ports/out/repositories';

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
