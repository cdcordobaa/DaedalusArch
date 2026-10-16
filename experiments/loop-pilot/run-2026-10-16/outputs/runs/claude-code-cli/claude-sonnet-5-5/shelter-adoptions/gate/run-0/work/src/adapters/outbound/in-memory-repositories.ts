import type { Animal } from "../../domain/animal.js";
import type { AdoptionApplication } from "../../domain/application.js";
import type { FosterCarer, Placement } from "../../domain/foster.js";
import type {
  AnimalRepository,
  ApplicationRepository,
  FosterCarerRepository,
  NotificationRepository,
  PlacementRepository,
} from "../../application/ports.js";
import type { Notification } from "../../domain/notification.js";

export class InMemoryAnimalRepository implements AnimalRepository {
  readonly items = new Map<string, Animal>();

  async save(animal: Animal): Promise<void> {
    this.items.set(animal.id, animal);
  }

  async findById(id: string): Promise<Animal | undefined> {
    return this.items.get(id);
  }

  async findAll(): Promise<Animal[]> {
    return [...this.items.values()];
  }
}

export class InMemoryFosterCarerRepository implements FosterCarerRepository {
  private readonly items = new Map<string, FosterCarer>();

  async save(carer: FosterCarer): Promise<void> {
    this.items.set(carer.id, carer);
  }

  async findById(id: string): Promise<FosterCarer | undefined> {
    return this.items.get(id);
  }

  async findAll(): Promise<FosterCarer[]> {
    return [...this.items.values()];
  }
}

export class InMemoryPlacementRepository implements PlacementRepository {
  readonly items = new Map<string, Placement>();

  async save(placement: Placement): Promise<void> {
    this.items.set(placement.id, placement);
  }

  async saveIfWithinCapacity(placement: Placement, capacity: number): Promise<boolean> {
    const active = [...this.items.values()].filter((p) => p.carerId === placement.carerId && !p.endedAt);
    if (active.length >= capacity) return false;
    this.items.set(placement.id, placement);
    return true;
  }

  async findById(id: string): Promise<Placement | undefined> {
    return this.items.get(id);
  }

  async findActiveByAnimalId(animalId: string): Promise<Placement | undefined> {
    return [...this.items.values()].find((p) => p.animalId === animalId && !p.endedAt);
  }

  async findByCarerId(carerId: string): Promise<Placement[]> {
    return [...this.items.values()].filter((p) => p.carerId === carerId);
  }

  async findAll(): Promise<Placement[]> {
    return [...this.items.values()];
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  readonly items = new Map<string, Notification>();

  async save(notification: Notification): Promise<void> {
    this.items.set(notification.id, notification);
  }

  async findById(id: string): Promise<Notification | undefined> {
    return this.items.get(id);
  }

  async findByProviderMessageId(messageId: string): Promise<Notification | undefined> {
    return [...this.items.values()].find((n) => n.providerMessageId === messageId);
  }

  async findAll(): Promise<Notification[]> {
    return [...this.items.values()];
  }
}

export class InMemoryApplicationRepository implements ApplicationRepository {
  readonly items = new Map<string, AdoptionApplication>();

  async save(application: AdoptionApplication): Promise<void> {
    this.items.set(application.id, application);
  }

  async findById(id: string): Promise<AdoptionApplication | undefined> {
    return this.items.get(id);
  }

  async findByAnimalId(animalId: string): Promise<AdoptionApplication[]> {
    return [...this.items.values()].filter((a) => a.animalId === animalId);
  }

  async findAll(): Promise<AdoptionApplication[]> {
    return [...this.items.values()];
  }
}
