import type { Database } from './Database';
import type { MechanicRecord } from './records/MechanicRecord';

export class MechanicGateway {
  constructor(private readonly db: Database) {}

  insert(name: string): MechanicRecord {
    const row = { id: this.db.nextId('M'), name };
    this.db.mechanics.set(row.id, row);
    return { ...row };
  }

  byId(id: string): MechanicRecord | undefined {
    const row = this.db.mechanics.get(id);
    return row === undefined ? undefined : { ...row };
  }

  all(): MechanicRecord[] {
    return [...this.db.mechanics.values()].map((m) => ({ ...m }));
  }
}
