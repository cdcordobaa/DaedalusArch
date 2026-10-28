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
  }

  snapshot(): LotSnapshot {
    return {
      number: this.number.text, variety: this.variety, garden: this.kept, grams: this.weight.value,
      germination: this.germination.percent, intake: this.intake.text,
      cameFrom: this.cameFrom === null ? null : this.cameFrom.text,
    };
  }

  /** Moves part of this lot into a new lot at another garden; refuses before changing anything. */
  shareOut(amount: Grams, garden: string, issueNumber: () => LotNumber, on: Day): SeedLot {
    const target = garden.trim();
    if (target === '') throw new LibraryRefusal('a share needs a garden');
    if (!amount.isPositive()) throw new LibraryRefusal('share at least 1 g');
    if (amount.exceeds(this.weight)) throw new LibraryRefusal(`not enough seed: ${this.number.text} holds ${this.weight.toString()}`);
    if (target === this.kept) throw new LibraryRefusal(`${this.number.text} is already at ${target}`);
    const release = this.intake.addDays(QUARANTINE_DAYS);
    if (on.daysSince(release) < 0) throw new LibraryRefusal(`lot ${this.number.text} is in quarantine until ${release.text}`);
    if (this.germination.percent < MIN_SHARE_GERMINATION) throw new LibraryRefusal(`germination ${String(this.germination.percent)}% is below ${String(MIN_SHARE_GERMINATION)}%`);
    const fresh = new SeedLot(issueNumber(), this.variety, target, amount, this.germination, on, this.number);
    this.weight = this.weight.minus(amount);
    return fresh;
  }

  /** Hands over the events raised since the last call, once. */
  takeUnsent(): LibraryEvent[] {
    const out = this.unsent;
    this.unsent = [];
    return out;
  }
}
