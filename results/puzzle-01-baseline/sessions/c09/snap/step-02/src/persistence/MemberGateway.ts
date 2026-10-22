import type { Database } from './Database';
import type { MemberRecord } from './records/MemberRecord';

export class MemberGateway {
  constructor(private readonly db: Database) {}

  insert(name: string): MemberRecord {
    const row: MemberRecord = { id: this.db.nextId('M'), name, suspended: false, suspensionSource: null, notices: [] };
    this.db.members.set(row.id, row);
    return { ...row };
  }

  byId(id: string): MemberRecord | undefined {
    const row = this.db.members.get(id);
    return row === undefined ? undefined : { ...row, notices: [...row.notices] };
  }

  update(record: MemberRecord): void {
    this.db.members.set(record.id, { ...record, notices: [...record.notices] });
  }
}
