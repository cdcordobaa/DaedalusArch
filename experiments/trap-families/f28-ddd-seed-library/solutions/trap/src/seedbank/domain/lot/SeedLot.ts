import { Day } from '../../../shared-kernel/Day';
import type { LibraryEvent } from '../../../shared-kernel/LibraryEvent';
import { LibraryRefusal } from '../LibraryRefusal';
import { LotDonated } from './events/LotDonated';
import { Germination } from './values/Germination';
import { Grams } from './values/Grams';
import { LotNumber } from './values/LotNumber';

/** What the shelf keeps of a lot between requests. */
export interface LotSnapshot {
  readonly number: string;
  readonly variety: string;
  readonly garden: string;
  readonly grams: number;
  readonly germination: number;
  readonly intake: string;
  readonly cameFrom?: string | null;
  readonly log?: readonly LogLine[];
}

export interface LogLine {
  readonly entry: string;
  readonly grams: number;
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
  cameFrom: string | null = null;
  log: LogLine[] = [];

  private constructor(
    readonly number: LotNumber,
    readonly variety: string,
    private kept: string,
    private weight: Grams,
    readonly germination: Germination,
    readonly intake: Day,
  ) {}

  static donate(number: LotNumber, d: Donation): SeedLot {
    if (d.variety.trim() === '') throw new LibraryRefusal('a lot needs a variety name');
    if (d.garden.trim() === '') throw new LibraryRefusal('a lot needs a garden');
    if (!d.grams.isPositive()) throw new LibraryRefusal('a donation must weigh at least 1 g');
    const lot = new SeedLot(number, d.variety.trim(), d.garden.trim(), d.grams, d.germination, d.on);
    lot.log.push({ entry: 'donated', grams: d.grams.value, otherLot: null });
    lot.unsent.push(new LotDonated(number.text, d.donor, lot.variety, d.grams.value));
    return lot;
  }

  static fromSnapshot(s: LotSnapshot): SeedLot {
    const lot = new SeedLot(LotNumber.of(s.number), s.variety, s.garden, Grams.of(s.grams), Germination.of(s.germination), Day.parse(s.intake));
    lot.cameFrom = s.cameFrom ?? null;
    lot.log = [...(s.log ?? [])];
    return lot;
  }

  get garden(): string {
    return this.kept;
  }

  get grams(): Grams {
    return this.weight;
  }

  /** A member takes seed home to sow. */
  handOut(amount: Grams, entry = 'taken', otherLot: string | null = null): void {
    if (!amount.isPositive()) throw new LibraryRefusal('take at least 1 g');
    if (amount.exceeds(this.weight)) throw new LibraryRefusal(`not enough seed: ${this.number.text} holds ${this.weight.toString()}`);
    this.weight = this.weight.minus(amount);
    this.log.push({ entry, grams: amount.value, otherLot });
  }

  snapshot(): LotSnapshot {
    return {
      number: this.number.text, variety: this.variety, garden: this.kept, grams: this.weight.value,
      germination: this.germination.percent, intake: this.intake.text, cameFrom: this.cameFrom, log: [...this.log],
    };
  }

  /** Hands over the events raised since the last call, once. */
  takeUnsent(): LibraryEvent[] {
    const out = this.unsent;
    this.unsent = [];
    return out;
  }
}
