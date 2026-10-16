import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/adoption-application';
import { AnimalRepository, ApplicationRepository } from '../../application/ports';

export class InMemoryAnimalRepository implements AnimalRepository {
  private readonly items = new Map<string, Animal>();
  save(animal: Animal): void {
    this.items.set(animal.id, animal);
  }
  findById(id: string): Animal | undefined {
    return this.items.get(id);
  }
  findAll(): Animal[] {
    return [...this.items.values()];
  }
}

export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly items = new Map<string, AdoptionApplication>();
  save(app: AdoptionApplication): void {
    this.items.set(app.id, app);
  }
  findById(id: string): AdoptionApplication | undefined {
    return this.items.get(id);
  }
  findByAnimal(animalId: string): AdoptionApplication[] {
    return [...this.items.values()].filter((a) => a.animalId === animalId);
  }
}
