import type { Outbox } from '../../plumbing/Outbox';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Lot, type LotRecord } from '../domain/Lot';
import type { LotStore } from '../domain/LotStore';

export class InMemoryLotStore implements LotStore {
  private readonly rows = new Map<string, LotRecord>();
  private numbering = 0;

  constructor(private readonly outbox: Outbox) {}

  newId(): string {
    this.numbering += 1;
    return `LOT-${String(this.numbering)}`;
  }

  find(id: string): Lot | undefined {
    const row = this.rows.get(id);
    return row === undefined ? undefined : Lot.fromRecord(row);
  }

  save(lot: Lot, events: readonly DomainEvent[] = []): void {
    this.rows.set(lot.id, lot.toRecord());
    this.outbox.append(events);
  }
}
