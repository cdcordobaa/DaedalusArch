import type { Database } from './Database';
import type { LoanRecord } from './records/LoanRecord';

export class LoanGateway {
  constructor(private readonly db: Database) {}

  insert(record: Omit<LoanRecord, 'id'>): LoanRecord {
    const row = { ...record, id: this.db.nextId('L') };
    this.db.loans.set(row.id, row);
    return { ...row };
  }

  update(record: LoanRecord): void {
    this.db.loans.set(record.id, { ...record });
  }

  byId(id: string): LoanRecord | undefined {
    const row = this.db.loans.get(id);
    return row === undefined ? undefined : { ...row };
  }

  openLoansOf(memberId: string): LoanRecord[] {
    return [...this.db.loans.values()].filter((l) => l.memberId === memberId && l.returnedDay === null).map((l) => ({ ...l }));
  }

  /** Nightly batch: flags every open loan due before `today`; returns the loans it flagged. */
  markOverdue(today: string): LoanRecord[] {
    const flagged: LoanRecord[] = [];
    for (const loan of this.db.loans.values()) {
      if (loan.returnedDay === null && !loan.overdue && loan.dueDay < today) {
        loan.overdue = true;
        flagged.push({ ...loan });
      }
    }
    return flagged;
  }
}
