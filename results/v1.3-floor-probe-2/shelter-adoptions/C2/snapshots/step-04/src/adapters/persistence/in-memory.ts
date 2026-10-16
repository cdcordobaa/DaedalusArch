import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/application';
import { FosterCarer, Placement } from '../../domain/foster';
import { Notification } from '../../domain/notification';
import { AnimalRepository, ApplicationRepository, CarerRepository, NotificationRepository, PlacementRepository } from '../../ports/out/repositories';
import { Restorable } from './memory-store';

export class InMemoryAnimalRepository implements AnimalRepository, Restorable {
  private items = new Map<string, Animal>();
  snapshot(): unknown { return new Map(this.items); }
  restore(s: unknown): void { this.items = new Map(s as Map<string, Animal>); }
  save(a: Animal): void { this.items.set(a.id, a); }
  get(id: string): Animal | undefined { return this.items.get(id); }
  list(): Animal[] { return [...this.items.values()]; }
}

export class InMemoryApplicationRepository implements ApplicationRepository, Restorable {
  private items = new Map<string, AdoptionApplication>();
  snapshot(): unknown { return new Map(this.items); }
  restore(s: unknown): void { this.items = new Map(s as Map<string, AdoptionApplication>); }
  save(a: AdoptionApplication): void { this.items.set(a.id, a); }
  get(id: string): AdoptionApplication | undefined { return this.items.get(id); }
  byAnimal(animalId: string): AdoptionApplication[] { return [...this.items.values()].filter((a) => a.animalId === animalId); }
}

export class InMemoryCarerRepository implements CarerRepository, Restorable {
  private items = new Map<string, FosterCarer>();
  snapshot(): unknown { return new Map(this.items); }
  restore(s: unknown): void { this.items = new Map(s as Map<string, FosterCarer>); }
  save(c: FosterCarer): void { this.items.set(c.id, c); }
  get(id: string): FosterCarer | undefined { return this.items.get(id); }
  list(): FosterCarer[] { return [...this.items.values()]; }
}

export class InMemoryPlacementRepository implements PlacementRepository, Restorable {
  private items = new Map<string, Placement>();
  snapshot(): unknown { return new Map(this.items); }
  restore(s: unknown): void { this.items = new Map(s as Map<string, Placement>); }
  save(p: Placement): void { this.items.set(p.id, p); }
  get(id: string): Placement | undefined { return this.items.get(id); }
  activeForCarer(carerId: string): Placement[] { return [...this.items.values()].filter((p) => p.carerId === carerId && !p.endedAt); }
  activeForAnimal(animalId: string): Placement | undefined { return [...this.items.values()].find((p) => p.animalId === animalId && !p.endedAt); }
}

export class InMemoryNotificationRepository implements NotificationRepository, Restorable {
  private items = new Map<string, Notification>();
  snapshot(): unknown { return new Map(this.items); }
  restore(s: unknown): void { this.items = new Map(s as Map<string, Notification>); }
  save(n: Notification): void { this.items.set(n.id, { ...n }); }
  get(id: string): Notification | undefined { return this.items.get(id); }
  byProviderId(pid: string): Notification | undefined { return [...this.items.values()].find((n) => n.providerMessageId === pid); }
  list(): Notification[] { return [...this.items.values()]; }
}
