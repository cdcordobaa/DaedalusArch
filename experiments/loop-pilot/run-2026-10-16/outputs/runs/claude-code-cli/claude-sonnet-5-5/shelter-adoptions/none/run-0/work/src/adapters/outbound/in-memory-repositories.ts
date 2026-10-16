import type { Animal } from "../../domain/animal.js";
import type { AdoptionApplication } from "../../domain/adoption-application.js";
import type { FosterCarer, Placement } from "../../domain/foster.js";
import type {
  AnimalRepository,
  ApplicationRepository,
  AuditedChange,
  AuditedStore,
  AuditLog,
  CarerRepository,
  IdGenerator,
  NotificationRepository,
  PlacementRepository,
} from "../../application/ports.js";
import type { AuditEntityType, AuditEntry } from "../../domain/audit.js";
import type { Notification } from "../../domain/notification.js";

/** Base for repositories whose state can be captured and restored (used for atomic commits). */
class MapStore<T extends { id: string }> {
  protected readonly items = new Map<string, T>();

  snapshot(): () => void {
    const copy = new Map(this.items);
    return () => {
      this.items.clear();
      for (const [k, v] of copy) this.items.set(k, v);
    };
  }

  async findById(id: string): Promise<T | undefined> {
    return this.items.get(id);
  }

  async save(item: T): Promise<void> {
    this.items.set(item.id, item);
  }
}

export class InMemoryNotificationRepository
  extends MapStore<Notification>
  implements NotificationRepository
{
  async findByProviderMessageId(messageId: string): Promise<Notification | undefined> {
    return [...this.items.values()].find((n) => n.providerMessageId === messageId);
  }

  async findAll(): Promise<Notification[]> {
    return [...this.items.values()];
  }
}

export class InMemoryCarerRepository implements CarerRepository {
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

export class InMemoryPlacementRepository extends MapStore<Placement> implements PlacementRepository {
  async findActiveByAnimalId(animalId: string): Promise<Placement | undefined> {
    return [...this.items.values()].find(
      (p) => p.animalId === animalId && p.endedAt === undefined,
    );
  }

  async findByCarerId(carerId: string): Promise<Placement[]> {
    return [...this.items.values()].filter((p) => p.carerId === carerId);
  }
}

export class InMemoryAnimalRepository extends MapStore<Animal> implements AnimalRepository {
  async findAll(): Promise<Animal[]> {
    return [...this.items.values()];
  }
}

export class InMemoryApplicationRepository
  extends MapStore<AdoptionApplication>
  implements ApplicationRepository
{
  async findByAnimalId(animalId: string): Promise<AdoptionApplication[]> {
    return [...this.items.values()].filter((a) => a.animalId === animalId);
  }
}

interface AuditedRepo {
  snapshot(): () => void;
  findById(id: string): Promise<{ id: string } | undefined>;
  save(item: never): Promise<void>;
}

/** Applies entity saves and audit entries together; any failure rolls everything back. */
export class InMemoryAuditStore implements AuditedStore, AuditLog {
  private entries: AuditEntry[] = [];
  private lock: Promise<unknown> = Promise.resolve();
  private readonly repos: Record<AuditEntityType, AuditedRepo>;

  constructor(
    animals: InMemoryAnimalRepository,
    applications: InMemoryApplicationRepository,
    placements: InMemoryPlacementRepository,
    notifications: InMemoryNotificationRepository,
    private readonly ids: IdGenerator,
  ) {
    this.repos = {
      animal: animals as unknown as AuditedRepo,
      application: applications as unknown as AuditedRepo,
      placement: placements as unknown as AuditedRepo,
      notification: notifications as unknown as AuditedRepo,
    };
  }

  commit(actor: string, at: Date, changes: AuditedChange[]): Promise<void> {
    const run = this.lock.then(() => this.apply(actor, at, changes));
    this.lock = run.catch(() => undefined);
    return run;
  }

  private async apply(actor: string, at: Date, changes: AuditedChange[]): Promise<void> {
    const restores = Object.values(this.repos).map((r) => r.snapshot());
    try {
      const added: AuditEntry[] = [];
      for (const c of changes) {
        const repo = this.repos[c.entityType];
        const before = (await repo.findById(c.entity.id)) ?? null;
        await repo.save(c.entity as never);
        added.push({
          id: this.ids.next(),
          entityType: c.entityType,
          entityId: c.entity.id,
          ...(c.animalId === undefined ? {} : { animalId: c.animalId }),
          actor,
          at: at.toISOString(),
          before: before === null ? null : structuredClone(before),
          after: structuredClone(c.entity),
        });
      }
      this.entries = [...this.entries, ...added];
    } catch (err) {
      for (const restore of restores) restore();
      throw err;
    }
  }

  async findByAnimal(animalId: string): Promise<AuditEntry[]> {
    return this.entries.filter((e) => e.animalId === animalId);
  }

  async findByActor(actor: string, fromMs?: number, toMs?: number): Promise<AuditEntry[]> {
    return this.entries.filter((e) => {
      const t = Date.parse(e.at);
      return (
        e.actor === actor && (fromMs === undefined || t >= fromMs) && (toMs === undefined || t <= toMs)
      );
    });
  }
}
