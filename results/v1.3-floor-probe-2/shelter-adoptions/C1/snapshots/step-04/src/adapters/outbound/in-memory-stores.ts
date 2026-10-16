import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/adoption-application';
import { FosterCarer, FosterPlacement } from '../../domain/foster';
import { Notification } from '../../domain/notification';
import { AuditEntry } from '../../domain/audit-entry';
import { AuditStore, TransactionRunner, AnimalStore, ApplicationStore, CarerStore, NotificationStore, PlacementStore } from '../../application/ports/outbound';

export class InMemoryAnimalStore implements AnimalStore {
  private rows = new Map<string, Animal>();
  save(a: Animal): void { this.rows.set(a.id, a); }
  find(id: string): Animal | undefined { return this.rows.get(id); }
  all(): Animal[] { return [...this.rows.values()]; }
}

export class InMemoryApplicationStore implements ApplicationStore {
  private rows = new Map<string, AdoptionApplication>();
  save(a: AdoptionApplication): void { this.rows.set(a.id, a); }
  find(id: string): AdoptionApplication | undefined { return this.rows.get(id); }
  forAnimal(animalId: string): AdoptionApplication[] { return [...this.rows.values()].filter((a) => a.animalId === animalId); }
}

export class InMemoryCarerStore implements CarerStore {
  private rows = new Map<string, FosterCarer>();
  save(c: FosterCarer): void { this.rows.set(c.id, c); }
  find(id: string): FosterCarer | undefined { return this.rows.get(id); }
  all(): FosterCarer[] { return [...this.rows.values()]; }
}

export class InMemoryPlacementStore implements PlacementStore {
  private rows = new Map<string, FosterPlacement>();
  save(p: FosterPlacement): void { this.rows.set(p.id, p); }
  find(id: string): FosterPlacement | undefined { return this.rows.get(id); }
  activeFor(f: { animalId?: string; carerId?: string }): FosterPlacement[] {
    return [...this.rows.values()].filter((p) => p.active && (f.animalId === undefined || p.animalId === f.animalId) && (f.carerId === undefined || p.carerId === f.carerId));
  }
}

export class InMemoryNotificationStore implements NotificationStore {
  private rows = new Map<string, Notification>();
  save(n: Notification): void { this.rows.set(n.id, n); }
  byProviderId(id: string): Notification | undefined { return [...this.rows.values()].find((n) => n.providerId === id); }
  all(): Notification[] { return [...this.rows.values()]; }
}

export class InMemoryAuditStore implements AuditStore {
  private rows: AuditEntry[] = [];
  add(e: AuditEntry): void { this.rows.push(e); }
  byAnimal(animalId: string): AuditEntry[] { return this.rows.filter((e) => e.animalId === animalId); }
  byStaff(staffId: string, from: string, to: string): AuditEntry[] {
    return this.rows.filter((e) => e.changedBy === staffId && e.changedAt >= from && e.changedAt <= to);
  }
}

/**
 * Transactions for the in-memory stores: the stores' row collections and the stored objects' fields are copied before
 * the callback and written back if it throws (the domain objects are mutable).
 */
export class InMemoryTransactions implements TransactionRunner {
  private depth = 0;
  constructor(private readonly stores: { rows: unknown }[]) {}

  inTransaction<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    const saved = this.stores.map((s) => {
      const rows = s.rows instanceof Map ? new Map(s.rows) : [...(s.rows as unknown[])];
      const values = s.rows instanceof Map ? [...s.rows.values()] : [...(s.rows as unknown[])];
      return { rows, fields: values.map((v) => [v, { ...(v as object) }] as const) };
    });
    this.depth++;
    try {
      return fn();
    } catch (e) {
      this.stores.forEach((s, i) => {
        const snap = saved[i];
        if (!snap) return;
        s.rows = snap.rows;
        for (const [obj, fields] of snap.fields) Object.assign(obj as object, fields);
      });
      throw e;
    } finally {
      this.depth--;
    }
  }
}
