import type { SchoolHappening } from './happenings';

export class SchoolRefusal extends Error {
  override readonly name = 'SchoolRefusal';
}

/** `requested`: the fee is asked of the pass office and the place is kept meanwhile. */
export type PlaceState = 'requested' | 'paid' | 'declined';
export type LessonStatus = 'open';

export interface LessonRecord {
  readonly lessonId: string;
  readonly title: string;
  readonly day: string;
  readonly price: number;
  readonly places: number;
  readonly status: LessonStatus;
  readonly seats: Readonly<Record<string, PlaceState>>;
}

const TAKES_A_PLACE: readonly string[] = ['requested', 'paid'];

/** One group lesson of the ski school on one day. It never has more pupils than places. */
export class Lesson {
  private constructor(
    readonly lessonId: string,
    readonly title: string,
    readonly day: string,
    readonly price: number,
    readonly places: number,
    private phase: LessonStatus,
    private seats: Record<string, PlaceState>,
  ) {}

  static offer(lessonId: string, title: string, day: string, places: number, price: number): { lesson: Lesson; said: SchoolHappening[] } {
    if (title.trim() === '') throw new SchoolRefusal('a lesson needs a title');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new SchoolRefusal('a lesson needs a day (YYYY-MM-DD)');
    if (!Number.isInteger(places) || places < 1 || places > 12) throw new SchoolRefusal('a lesson has 1 to 12 places');
    if (!Number.isInteger(price) || price < 0) throw new SchoolRefusal('the price is a whole number of euros');
    return { lesson: new Lesson(lessonId, title, day, price, places, 'open', {}), said: [{ kind: 'LessonOffered', lessonId, day }] };
  }

  static fromRecord(r: LessonRecord): Lesson {
    return new Lesson(r.lessonId, r.title, r.day, r.price, r.places, r.status, { ...r.seats });
  }

  get status(): LessonStatus {
    return this.phase;
  }

  placesLeft(): number {
    return this.places - Object.values(this.seats).filter((s) => TAKES_A_PLACE.includes(s)).length;
  }

  placeOf(passNo: string): PlaceState | undefined {
    return this.seats[passNo];
  }

  /** Pass numbers that hold a place now. */
  holders(): string[] {
    return Object.keys(this.seats).filter((p) => TAKES_A_PLACE.includes(this.seats[p]!));
  }

  enrol(passNo: string): SchoolHappening[] {
    const now = this.seats[passNo];
    if (now !== undefined && TAKES_A_PLACE.includes(now)) throw new SchoolRefusal(`${passNo} already has a place in ${this.lessonId}`);
    if (this.placesLeft() === 0) throw new SchoolRefusal(`lesson ${this.lessonId} is full`);
    this.seats = { ...this.seats, [passNo]: 'requested' };
    return [{ kind: 'FeeRequested', passNo, lessonId: this.lessonId, euros: this.price }];
  }

  /** The pass office took the fee. */
  feePaid(passNo: string): SchoolHappening[] {
    if (this.seats[passNo] === 'requested') this.seats = { ...this.seats, [passNo]: 'paid' };
    return [];
  }

  /** The pass could not pay: nothing was taken and the pupil holds no place. */
  feeDeclined(passNo: string): SchoolHappening[] {
    if (this.seats[passNo] === 'requested') this.seats = { ...this.seats, [passNo]: 'declined' };
    return [];
  }

  /** The desk takes a pupil off the list (they changed their mind before the lesson). */
  withdraw(passNo: string): SchoolHappening[] {
    const now = this.seats[passNo];
    if (now === undefined || !TAKES_A_PLACE.includes(now)) throw new SchoolRefusal(`${passNo} has no place in ${this.lessonId}`);
    const { [passNo]: _gone, ...rest } = this.seats;
    this.seats = rest;
    return now === 'paid' && this.price > 0 ? [{ kind: 'FeeRefundDue', passNo, lessonId: this.lessonId, euros: this.price }] : [];
  }

  toRecord(): LessonRecord {
    return { lessonId: this.lessonId, title: this.title, day: this.day, price: this.price, places: this.places, status: this.phase, seats: { ...this.seats } };
  }
}
