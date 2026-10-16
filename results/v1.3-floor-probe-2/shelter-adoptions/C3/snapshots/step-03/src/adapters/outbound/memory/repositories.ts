import { Animal, Application, Carer, Placement, SentNotification } from '../../../domain/model';
import { AnimalRepository, ApplicationRepository, CarerRepository, NotificationRepository, PlacementRepository } from '../../../domain/ports/repositories';

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

export class MemoryCarers implements CarerRepository {
  private readonly m = new Map<string, Carer>();
  put(c: Carer): void { this.m.set(c.id, c); }
  get(id: string): Carer | undefined { return this.m.get(id); }
  all(): Carer[] { return [...this.m.values()]; }
}

export class MemoryPlacements implements PlacementRepository {
  private readonly m = new Map<string, Placement>();
  put(p: Placement): void { this.m.set(p.id, p); }
  get(id: string): Placement | undefined { return this.m.get(id); }
  current(): Placement[] { return [...this.m.values()].filter((p) => !p.until); }
}

export class MemoryNotifications implements NotificationRepository {
  private readonly m = new Map<string, SentNotification>();
  put(n: SentNotification): void { this.m.set(n.id, n); }
  bySmsId(smsId: string): SentNotification | undefined { return [...this.m.values()].find((n) => n.smsId === smsId); }
  all(): SentNotification[] { return [...this.m.values()]; }
}
