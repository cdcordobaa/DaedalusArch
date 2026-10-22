export type StatementKind = 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';

export interface StatementItem {
  readonly kind: StatementKind;
  readonly amount: number;
  readonly counterpart: string | null;
}

/** Every stored movement per account, in the order it happened; shared by every use case. */
export class StatementLog {
  private readonly rows = new Map<string, StatementItem[]>();

  record(accountId: string, item: StatementItem): void {
    this.rows.set(accountId, [...(this.rows.get(accountId) ?? []), item]);
  }

  newestFirst(accountId: string): StatementItem[] {
    return [...(this.rows.get(accountId) ?? [])].reverse();
  }
}
