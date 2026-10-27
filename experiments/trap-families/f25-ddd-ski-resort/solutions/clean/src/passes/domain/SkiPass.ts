import type { PassHappening } from './happenings';

export class PassRefusal extends Error {
  override readonly name = 'PassRefusal';
}

export type PassStatus = 'active' | 'blocked';

/** What a pass did for each lesson it paid: paid, then perhaps refunded once. */
export type LessonLedger = Readonly<Record<string, 'paid' | 'refunded'>>;

export interface PassRecord {
  readonly passNo: string;
  readonly holder: string;
  readonly credit: number;
  readonly status: PassStatus;
  readonly lessons: LessonLedger;
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
    private lessons: Record<string, 'paid' | 'refunded'>,
  ) {}

  static issue(passNo: string, holder: string, credit: number): { pass: SkiPass; said: PassHappening[] } {
    if (holder.trim() === '') throw new PassRefusal('a pass needs a holder');
    if (!Number.isInteger(credit) || credit < 0) throw new PassRefusal('credit is a whole number of euros');
    return { pass: new SkiPass(passNo, holder, credit, 'active', {}), said: [{ kind: 'PassIssued', passNo, holder }] };
  }

  static fromRecord(r: PassRecord): SkiPass {
    return new SkiPass(r.passNo, r.holder, r.credit, r.status, { ...r.lessons });
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

  /**
   * Answers a lesson's request for payment. It never throws for a low credit or a blocked pass: it says whether the
   * lesson was paid. Asking again for the same lesson says nothing new.
   */
  payForLesson(lessonId: string, price: number): PassHappening[] {
    if (this.lessons[lessonId] !== undefined) return [];
    if (this.state === 'blocked') return [{ kind: 'LessonPaymentRefused', passNo: this.passNo, lessonId, why: 'pass blocked' }];
    if (price > this.balance) return [{ kind: 'LessonPaymentRefused', passNo: this.passNo, lessonId, why: `credit too low: ${String(this.balance)} left` }];
    this.balance -= price;
    this.lessons = { ...this.lessons, [lessonId]: 'paid' };
    return [
      { kind: 'CreditChanged', passNo: this.passNo, by: -price, note: `lesson ${lessonId}` },
      { kind: 'LessonPaid', passNo: this.passNo, lessonId },
    ];
  }

  /** Gives a paid lesson's price back as credit, once per lesson. A blocked pass still takes it (it moves to the new card). */
  refundLesson(lessonId: string, euros: number, note: string): PassHappening[] {
    if (this.lessons[lessonId] !== 'paid') return [];
    this.lessons = { ...this.lessons, [lessonId]: 'refunded' };
    if (euros <= 0) return [];
    this.balance += euros;
    return [{ kind: 'CreditChanged', passNo: this.passNo, by: euros, note }];
  }

  /** The card is reported lost. Reporting it again says nothing new. */
  block(): PassHappening[] {
    if (this.state === 'blocked') return [];
    this.state = 'blocked';
    return [{ kind: 'PassBlocked', passNo: this.passNo }];
  }

  toRecord(): PassRecord {
    return { passNo: this.passNo, holder: this.holder, credit: this.balance, status: this.state, lessons: { ...this.lessons } };
  }
}
