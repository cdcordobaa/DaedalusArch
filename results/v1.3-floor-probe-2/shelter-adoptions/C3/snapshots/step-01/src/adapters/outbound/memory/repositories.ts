import { Animal, Application } from '../../../domain/model';
import { AnimalRepository, ApplicationRepository } from '../../../domain/ports/repositories';

export class MemoryAnimals implements AnimalRepository {
  private readonly m = new Map<string, Animal>();
  put(a: Animal): void { this.m.set(a.id, a); }
  get(id: string): Animal | undefined { return this.m.get(id); }
  all(): Animal[] { return [...this.m.values()]; }
}

export class MemoryApplications implements ApplicationRepository {
  private readonly m = new Map<string, Application>();
  put(a: Application): void { this.m.set(a.id, a); }
  get(id: string): Application | undefined { return this.m.get(id); }
  ofAnimal(animalId: string): Application[] { return [...this.m.values()].filter((a) => a.animalId === animalId); }
}
