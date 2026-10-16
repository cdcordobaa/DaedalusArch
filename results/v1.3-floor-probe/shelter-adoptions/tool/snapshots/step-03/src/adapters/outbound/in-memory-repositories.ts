import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/adoption-application';
import {
  AnimalRepository,
  ApplicationRepository,
  CarerRepository,
  NotificationRepository,
  PlacementRepository,
} from '../../application/ports';
import { Notification } from '../../domain/notification';
import { FosterCarer, Placement, isActive } from '../../domain/foster';

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

export class InMemoryCarerRepository implements CarerRepository {
  private readonly items = new Map<string, FosterCarer>();
  save(carer: FosterCarer): void {
    this.items.set(carer.id, carer);
  }
  findById(id: string): FosterCarer | undefined {
    return this.items.get(id);
  }
  findAll(): FosterCarer[] {
    return [...this.items.values()];
  }
}

export class InMemoryPlacementRepository implements PlacementRepository {
  private readonly items = new Map<string, Placement>();
  save(placement: Placement): void {
    this.items.set(placement.id, placement);
  }
  findById(id: string): Placement | undefined {
    return this.items.get(id);
  }
  findActiveByCarer(carerId: string): Placement[] {
    return [...this.items.values()].filter((p) => p.carerId === carerId && isActive(p));
  }
  findActiveByAnimal(animalId: string): Placement | undefined {
    return [...this.items.values()].find((p) => p.animalId === animalId && isActive(p));
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly items = new Map<string, Notification>();
  save(n: Notification): void {
    this.items.set(n.id, n);
  }
  findById(id: string): Notification | undefined {
    return this.items.get(id);
  }
  findByProviderMessageId(messageId: string): Notification | undefined {
    return [...this.items.values()].find((n) => n.providerMessageId === messageId);
  }
  findAll(): Notification[] {
    return [...this.items.values()];
  }
}
