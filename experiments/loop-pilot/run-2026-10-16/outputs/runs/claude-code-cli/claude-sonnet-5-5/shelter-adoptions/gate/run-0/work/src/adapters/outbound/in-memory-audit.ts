import type { AuditEntry } from "../../domain/audit.js";
import { ConflictError } from "../../domain/errors.js";
import type { AuditLogReader, ChangeStore, Clock, IdGenerator, PendingChange } from "../../application/ports.js";
import type {
  InMemoryAnimalRepository,
  InMemoryApplicationRepository,
  InMemoryNotificationRepository,
  InMemoryPlacementRepository,
} from "./in-memory-repositories.js";

export class InMemoryAuditLog implements AuditLogReader {
  readonly entries: AuditEntry[] = [];

  async findByAnimalId(animalId: string): Promise<AuditEntry[]> {
    return this.entries.filter((e) => e.animalId === animalId);
  }

  async findByActor(actor: string, from: string, to: string): Promise<AuditEntry[]> {
    const start = Date.parse(from);
    const end = Date.parse(to);
    return this.entries.filter((e) => {
      const at = Date.parse(e.at);
      return e.actor === actor && at >= start && at <= end;
    });
  }
}

export class InMemoryChangeStore implements ChangeStore {
  /** Commits run one at a time so a rollback never discards another commit's writes. */
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly animals: InMemoryAnimalRepository,
    private readonly applications: InMemoryApplicationRepository,
    private readonly placements: InMemoryPlacementRepository,
    private readonly notifications: InMemoryNotificationRepository,
    private readonly log: InMemoryAuditLog,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  commit(changes: PendingChange[], actor: string): Promise<void> {
    const run = this.tail.then(() => this.apply(changes, actor));
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async apply(changes: PendingChange[], actor: string): Promise<void> {
    const snapshots = [
      { map: this.animals.items, copy: new Map(this.animals.items) },
      { map: this.applications.items, copy: new Map(this.applications.items) },
      { map: this.placements.items, copy: new Map(this.placements.items) },
      { map: this.notifications.items, copy: new Map(this.notifications.items) },
    ] as { map: Map<string, unknown>; copy: Map<string, unknown> }[];
    const logLength = this.log.entries.length;
    try {
      const entries: AuditEntry[] = [];
      const at = this.clock.now().toISOString();
      for (const change of changes) {
        const before = await this.read(change);
        if (change.entityType === "placement" && change.capacity !== undefined) {
          if (!(await this.placements.saveIfWithinCapacity(change.entity, change.capacity))) {
            throw new ConflictError("Carer is at full capacity");
          }
        } else {
          await this.write(change);
        }
        entries.push({
          id: this.ids.next(),
          entityType: change.entityType,
          entityId: change.entity.id,
          ...(change.entityType === "notification" ? {} : { animalId: animalIdOf(change) }),
          action: before === undefined ? "created" : "updated",
          actor,
          at,
          before: before === undefined ? null : structuredClone(before),
          after: structuredClone(change.entity),
        });
      }
      this.log.entries.push(...entries);
    } catch (err) {
      for (const { map, copy } of snapshots) {
        map.clear();
        for (const [k, v] of copy) map.set(k, v);
      }
      this.log.entries.length = logLength;
      throw err;
    }
  }

  private read(change: PendingChange): Promise<unknown> {
    switch (change.entityType) {
      case "animal":
        return this.animals.findById(change.entity.id);
      case "application":
        return this.applications.findById(change.entity.id);
      case "placement":
        return this.placements.findById(change.entity.id);
      case "notification":
        return this.notifications.findById(change.entity.id);
    }
  }

  private write(change: PendingChange): Promise<void> {
    switch (change.entityType) {
      case "animal":
        return this.animals.save(change.entity);
      case "application":
        return this.applications.save(change.entity);
      case "placement":
        return this.placements.save(change.entity);
      case "notification":
        return this.notifications.save(change.entity);
    }
  }
}

function animalIdOf(change: PendingChange): string {
  switch (change.entityType) {
    case "animal":
      return change.entity.id;
    case "application":
    case "placement":
      return change.entity.animalId;
    case "notification":
      return "";
  }
}
