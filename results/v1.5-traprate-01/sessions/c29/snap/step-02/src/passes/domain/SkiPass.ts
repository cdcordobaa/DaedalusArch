import type { PassHappening } from './happenings';

export class PassRefusal extends Error {
  override readonly name = 'PassRefusal';
}

export type PassStatus = 'active';

export interface PassRecord {
  readonly passNo: string;
  readonly holder: string;
  readonly credit: number;
  readonly status: PassStatus;
}

/**
 * A guest's lift pass. It carries credit in whole euros, loaded at the ticket office and spent at the kiosks on the
 * mountain; the credit never goes below zero.
 */
export class SkiPass {
  private constructor(
    readonly passNo: string,
    readonly holder: string,
    private balance: number,
    private state: PassStatus,
  ) {}

  static issue(passNo: string, holder: string, credit: number): { pass: SkiPass; said: PassHappening[] } {
    if (holder.trim() === '') throw new PassRefusal('a pass needs a holder');
    if (!Number.isInteger(credit) || credit < 0) throw new PassRefusal('credit is a whole number of euros');
    return { pass: new SkiPass(passNo, holder, credit, 'active'), said: [{ kind: 'PassIssued', passNo, holder }] };
  }

  static fromRecord(r: PassRecord): SkiPass {
    return new SkiPass(r.passNo, r.holder, r.credit, r.status);
  }

  get credit(): number {
    return this.balance;
  }

  get status(): PassStatus {
    return this.state;
  }

  load(euros: number, note: string): PassHappening[] {
    if (!Number.isInteger(euros) || euros <= 0) throw new PassRefusal('load a positive whole number of euros');
    this.balance += euros;
    return [{ kind: 'CreditChanged', passNo: this.passNo, by: euros, note }];
  }

  pay(euros: number, note: string): PassHappening[] {
    if (!Number.isInteger(euros) || euros <= 0) throw new PassRefusal('pay a positive whole number of euros');
    if (euros > this.balance) throw new PassRefusal(`credit too low: ${String(this.balance)} left`);
    this.balance -= euros;
    return [{ kind: 'CreditChanged', passNo: this.passNo, by: -euros, note }];
  }

  /** Takes a lesson fee if the credit covers it; otherwise takes nothing and says so. */
  payFee(euros: number, lessonId: string): PassHappening[] {
    if (euros > this.balance) return [{ kind: 'FeeDeclined', passNo: this.passNo, lessonId }];
    this.balance -= euros;
    const paid: PassHappening = { kind: 'FeePaid', passNo: this.passNo, lessonId };
    return euros === 0 ? [paid] : [{ kind: 'CreditChanged', passNo: this.passNo, by: -euros, note: `lesson ${lessonId}` }, paid];
  }

  toRecord(): PassRecord {
    return { passNo: this.passNo, holder: this.holder, credit: this.balance, status: this.state };
  }
}
