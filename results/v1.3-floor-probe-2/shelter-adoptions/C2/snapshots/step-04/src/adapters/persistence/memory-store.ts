import { AuditRecord } from '../../domain/audit';
import { AuditRepository, UnitOfWork } from '../../ports/out/audit';

/** Maps that can be snapshotted and restored, so a unit of work can roll back. */
export interface Restorable { snapshot(): unknown; restore(s: unknown): void }

export class InMemoryUnitOfWork implements UnitOfWork {
  private depth = 0;
  constructor(private readonly stores: Restorable[]) {}
  run<T>(work: () => T): T {
    if (this.depth > 0) return work();
    const snaps = this.stores.map((s) => s.snapshot());
    this.depth++;
    try {
      return work();
    } catch (e) {
      this.stores.forEach((s, i) => s.restore(snaps[i]));
      throw e;
    } finally {
      this.depth--;
    }
  }
}

export class InMemoryAuditRepository implements AuditRepository, Restorable {
  private items: AuditRecord[] = [];
  append(r: AuditRecord): void { this.items.push(r); }
  forAnimal(animalId: string): AuditRecord[] { return this.items.filter((r) => r.animalId === animalId); }
  byActor(actor: string, from: string, to: string): AuditRecord[] {
    return this.items.filter((r) => r.actor === actor && r.at >= from && r.at <= to);
  }
  snapshot(): unknown { return [...this.items]; }
  restore(s: unknown): void { this.items = [...(s as AuditRecord[])]; }
}
