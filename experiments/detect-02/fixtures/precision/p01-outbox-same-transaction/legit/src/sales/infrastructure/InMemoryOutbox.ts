import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from '../application/ports/Outbox';
import { OutboxMessage } from './OutboxMessage';

export class InMemoryOutbox implements Outbox {
  private rows: OutboxMessage[] = [];
  private seq = 0;

  async add(events: readonly DomainEvent[]): Promise<void> {
    for (const e of events) this.rows.push(new OutboxMessage(String(++this.seq), e.type, JSON.stringify(e)));
  }

  async takePending(limit: number): Promise<DomainEvent[]> {
    const out = this.rows.filter((r) => r.sentAt === null).slice(0, limit);
    for (const r of out) r.sentAt = new Date();
    return out.map((r) => JSON.parse(r.payload) as DomainEvent);
  }
}
