import { Animal, Application, Carer, Change, Placement, SentNotification } from '../../../domain/model';
import {
  AnimalRepository, ApplicationRepository, CarerRepository, ChangeLog, NotificationRepository, PlacementRepository, UnitOfWork,
} from '../../../domain/ports/repositories';

export class MemoryAnimals implements AnimalRepository {
  private m = new Map<string, Animal>();
  put(a: Animal): void { this.m.set(a.id, a); }
  get(id: string): Animal | undefined { return this.m.get(id); }
  all(): Animal[] { return [...this.m.values()]; }
}

export class MemoryApplications implements ApplicationRepository {
  private m = new Map<string, Application>();
  put(a: Application): void { this.m.set(a.id, a); }
  get(id: string): Application | undefined { return this.m.get(id); }
  ofAnimal(animalId: string): Application[] { return [...this.m.values()].filter((a) => a.animalId === animalId); }
}

export class MemoryCarers implements CarerRepository {
  private m = new Map<string, Carer>();
  put(c: Carer): void { this.m.set(c.id, c); }
  get(id: string): Carer | undefined { return this.m.get(id); }
  all(): Carer[] { return [...this.m.values()]; }
}

export class MemoryPlacements implements PlacementRepository {
  private m = new Map<string, Placement>();
  put(p: Placement): void { this.m.set(p.id, p); }
  get(id: string): Placement | undefined { return this.m.get(id); }
  current(): Placement[] { return [...this.m.values()].filter((p) => !p.until); }
}

export class MemoryNotifications implements NotificationRepository {
  private m = new Map<string, SentNotification>();
  put(n: SentNotification): void { this.m.set(n.id, n); }
  bySmsId(smsId: string): SentNotification | undefined { return [...this.m.values()].find((n) => n.smsId === smsId); }
  all(): SentNotification[] { return [...this.m.values()]; }
}

export class MemoryChangeLog implements ChangeLog {
  private m: Change[] = [];
  append(c: Change): void { this.m.push(c); }
  ofAnimal(animalId: string): Change[] { return this.m.filter((c) => c.animalId === animalId); }
  by(actor: string, from: string, to: string): Change[] { return this.m.filter((c) => c.by === actor && c.at >= from && c.at <= to); }
}

/** Entities are immutable records, so copying each store's collection is enough to roll back. */
export class MemoryUnitOfWork implements UnitOfWork {
  private nested = false;
  constructor(private readonly stores: { m: unknown }[]) {}
  atomic<T>(work: () => T): T {
    if (this.nested) return work();
    const copies = this.stores.map((s) => (s.m instanceof Map ? new Map(s.m) : [...(s.m as unknown[])]));
    this.nested = true;
    try {
      return work();
    } catch (e) {
      this.stores.forEach((s, i) => { s.m = copies[i]; });
      throw e;
    } finally {
      this.nested = false;
    }
  }
}
