import { Day } from '../../../shared-kernel/Day';
import type { LibraryEvent } from '../../../shared-kernel/LibraryEvent';
import { LibraryRefusal } from '../LibraryRefusal';
import { LotDonated } from './events/LotDonated';
import { Germination } from './values/Germination';
import { Grams } from './values/Grams';
import { LotNumber } from './values/LotNumber';

const QUARANTINE_DAYS = 30;
const MIN_SHARE_GERMINATION = 70;

/** What the shelf keeps of a lot between requests. */
export interface LotSnapshot {
  readonly number: string;
  readonly variety: string;
  readonly garden: string;
  readonly grams: number;
  readonly germination: number;
  readonly intake: string;
  /** The lot this one was shared from; null for a donated lot. */
  readonly cameFrom: string | null;
}

/** One line in a lot's history. */
export interface LogEntry {
  readonly entry: 'donated' | 'taken' | 'shared-out' | 'shared-in';
  readonly grams: number;
  /** The lot the seed went to (shared-out) or came from (shared-in); null otherwise. */
  readonly otherLot: string | null;
}

export interface Donation {
  readonly donor: string;
  readonly variety: string;
  readonly grams: Grams;
  readonly germination: Germination;
  readonly garden: string;
  readonly on: Day;
}

/** A batch of one seed variety kept at one garden. It never holds less than nothing. */
export class SeedLot {
  private unsent: LibraryEvent[] = [];
  private unlogged: LogEntry[] = [];

  private constructor(
    readonly number: LotNumber,
    readonly variety: string,
    private kept: string,
    private weight: Grams,
    readonly germination: Germination,
    readonly intake: Day,
    readonly cameFrom: LotNumber | null = null,
  ) {}

  static donate(number: LotNumber, d: Donation): SeedLot {
    if (d.variety.trim() === '') throw new LibraryRefusal('a lot needs a variety name');
    if (d.garden.trim() === '') throw new LibraryRefusal('a lot needs a garden');
    if (!d.grams.isPositive()) throw new LibraryRefusal('a donation must weigh at least 1 g');
    const lot = new SeedLot(number, d.variety.trim(), d.garden.trim(), d.grams, d.germination, d.on);
    lot.unsent.push(new LotDonated(number.text, d.donor, lot.variety, d.grams.value));
    lot.unlogged.push({ entry: 'donated', grams: d.grams.value, otherLot: null });
    return lot;
  }

  static fromSnapshot(s: LotSnapshot): SeedLot {
    return new SeedLot(LotNumber.of(s.number), s.variety, s.garden, Grams.of(s.grams), Germination.of(s.germination), Day.parse(s.intake),
      s.cameFrom === null ? null : LotNumber.of(s.cameFrom));
  }

  get garden(): string {
    return this.kept;
  }

  get grams(): Grams {
    return this.weight;
  }

  /** A member takes seed home to sow. */
  handOut(amount: Grams): void {
    if (!amount.isPositive()) throw new LibraryRefusal('take at least 1 g');
    if (amount.exceeds(this.weight)) throw new LibraryRefusal(`not enough seed: ${this.number.text} holds ${this.weight.toString()}`);
    this.weight = this.weight.minus(amount);
    this.unlogged.push({ entry: 'taken', grams: amount.value, otherLot: null });
  }

  snapshot(): LotSnapshot {
    return {
      number: this.number.text, variety: this.variety, garden: this.kept, grams: this.weight.value,
      germination: this.germination.percent, intake: this.intake.text,
      cameFrom: this.cameFrom === null ? null : this.cameFrom.text,
    };
  }

  /**
   * Moves grams into a brand-new lot at another garden. Everything is checked before
   * anything changes, and the new number is only drawn once the share is certain.
   */
  shareTo(garden: string, amount: Grams, on: Day, nextNumber: () => LotNumber): SeedLot {
    const target = garden.trim();
    if (target === '') throw new LibraryRefusal('a lot needs a garden');
    if (!amount.isPositive()) throw new LibraryRefusal('share at least 1 g');
    if (target === this.kept) throw new LibraryRefusal(`${this.number.text} is already at ${target}`);
    if (amount.exceeds(this.weight)) throw new LibraryRefusal(`not enough seed: ${this.number.text} holds ${this.weight.toString()}`);
    const free = this.intake.addDays(QUARANTINE_DAYS);
    if (on.daysSince(free) < 0) throw new LibraryRefusal(`lot ${this.number.text} is in quarantine until ${free.text}`);
    if (this.germination.percent < MIN_SHARE_GERMINATION) throw new LibraryRefusal(`germination ${this.germination.percent}% is below ${MIN_SHARE_GERMINATION}%`);
    const lot = new SeedLot(nextNumber(), this.variety, target, amount, this.germination, on, this.number);
    this.weight = this.weight.minus(amount);
    this.unlogged.push({ entry: 'shared-out', grams: amount.value, otherLot: lot.number.text });
    lot.unlogged.push({ entry: 'shared-in', grams: amount.value, otherLot: this.number.text });
    return lot;
  }

  /** Hands over the history entries made since the last call, once. */
  takeUnlogged(): LogEntry[] {
    const out = this.unlogged;
    this.unlogged = [];
    return out;
  }

  /** Hands over the events raised since the last call, once. */
  takeUnsent(): LibraryEvent[] {
    const out = this.unsent;
    this.unsent = [];
    return out;
  }
}
