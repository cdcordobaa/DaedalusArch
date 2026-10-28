import type { EventLog } from '../../bus/EventLog';
import { Pontoon, type PontoonRecord } from '../domain/pontoon/Pontoon';
import type { PontoonRepository } from '../domain/pontoon/PontoonRepository';

export class InMemoryPontoonStore implements PontoonRepository {
  private readonly records = new Map<string, PontoonRecord>();
  private issued = 0;

  constructor(private readonly log: EventLog) {}

  nextId(): string {
    this.issued += 1;
    return `PT-${String(this.issued)}`;
  }

  get(id: string): Pontoon | undefined {
    const r = this.records.get(id);
    return r === undefined ? undefined : Pontoon.fromRecord(r);
  }

  put(pontoon: Pontoon): void {
    const events = pontoon.drainRecorded();
    this.records.set(pontoon.id, pontoon.toRecord());
    this.log.append(events);
  }
}
