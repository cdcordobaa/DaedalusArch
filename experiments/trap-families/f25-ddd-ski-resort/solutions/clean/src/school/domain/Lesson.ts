import type { SchoolHappening } from './happenings';

export class SchoolRefusal extends Error {
  override readonly name = 'SchoolRefusal';
}

/** awaiting: reserved, payment asked for; paid; declined: the pass did not pay; released: given up for a lost pass. */
export type PlaceState = 'awaiting' | 'paid' | 'declined' | 'released';
export type LessonStatus = 'open' | 'called-off';

export interface LessonRecord {
  readonly lessonId: string;
  readonly title: string;
  readonly day: string;
  readonly price: number;
  readonly places: number;
  readonly status: LessonStatus;
  readonly seats: Readonly<Record<string, PlaceState>>;
}

const TAKES_A_PLACE: readonly string[] = ['awaiting', 'paid'];

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

  /** Reserves a place and asks the pupil's pass to pay for it. */
  enrol(passNo: string): SchoolHappening[] {
    if (this.phase === 'called-off') throw new SchoolRefusal(`lesson ${this.lessonId} is called off`);
    const now = this.seats[passNo];
    if (now !== undefined && TAKES_A_PLACE.includes(now)) throw new SchoolRefusal(`${passNo} already has a place in ${this.lessonId}`);
    if (this.placesLeft() === 0) throw new SchoolRefusal(`lesson ${this.lessonId} is full`);
    this.seats = { ...this.seats, [passNo]: 'awaiting' };
    return [{ kind: 'PlaceReserved', lessonId: this.lessonId, passNo, price: this.price }];
  }

  /** The pass answered: a paid place stays, an unpaid one is declined and free again. */
  settle(passNo: string, paid: boolean): SchoolHappening[] {
    if (this.seats[passNo] !== 'awaiting') return [];
    this.seats = { ...this.seats, [passNo]: paid ? 'paid' : 'declined' };
    return [];
  }

  /** The desk takes a pupil off the list (they changed their mind before the lesson). */
  withdraw(passNo: string): SchoolHappening[] {
    const now = this.seats[passNo];
    if (now === undefined || !TAKES_A_PLACE.includes(now)) throw new SchoolRefusal(`${passNo} has no place in ${this.lessonId}`);
    const { [passNo]: _gone, ...rest } = this.seats;
    this.seats = rest;
    return [];
  }

  /** Weather: the lesson will not run. Each paying pupil is owed the price. Calling off again says nothing new. */
  callOff(): SchoolHappening[] {
    if (this.phase === 'called-off') return [];
    this.phase = 'called-off';
    const refunds = Object.keys(this.seats).filter((p) => this.seats[p] === 'paid').map((passNo) => ({ passNo, euros: this.price }));
    return [{ kind: 'LessonCalledOff', lessonId: this.lessonId, refunds }];
  }

  /** The pupil's pass was reported lost: the place is given up, and a paid price is owed back. */
  giveBack(passNo: string): SchoolHappening[] {
    const now = this.seats[passNo];
    if (this.phase === 'called-off' || now === undefined || !TAKES_A_PLACE.includes(now)) return [];
    this.seats = { ...this.seats, [passNo]: 'released' };
    return [{ kind: 'PlaceGivenBack', lessonId: this.lessonId, passNo, euros: now === 'paid' ? this.price : 0 }];
  }

  toRecord(): LessonRecord {
    return { lessonId: this.lessonId, title: this.title, day: this.day, price: this.price, places: this.places, status: this.phase, seats: { ...this.seats } };
  }
}
