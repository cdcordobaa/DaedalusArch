import type { LoanRecord } from './records/LoanRecord';
import type { MemberRecord } from './records/MemberRecord';

/** The library's tables (in memory). */
export class Database {
  readonly loans = new Map<string, LoanRecord>();
  readonly members = new Map<string, MemberRecord>();
  private sequence = 0;

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, '0')}`;
  }
}
