import type { Outbox } from '../../messaging/Outbox';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Sailing, type SailingState } from '../domain/sailing/Sailing';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** Sailings and their outbox in one store: saving a sailing stores its pending events in the same step. */
export class InMemorySailingRepository implements SailingRepository, Outbox {
  private readonly rows = new Map<string, SailingState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): SailingId {
    this.sequence += 1;
    return SailingId.of(`S-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: SailingId): Sailing | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Sailing.restore(row);
  }

  save(sailing: Sailing): void {
    const events = sailing.pullEvents();
    this.rows.set(sailing.id.value, sailing.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
