import { Day } from '../../../shared-kernel/Day';
import type { LibraryEvent } from '../../../shared-kernel/LibraryEvent';
import { LibraryRefusal } from '../LibraryRefusal';
import { LotDonated } from './events/LotDonated';
import { PortionShared } from './events/PortionShared';
import type { LogEntry } from './LogEntry';
import { Germination } from './values/Germination';
import { Grams } from './values/Grams';
import { LotNumber } from './values/LotNumber';

/** Days seed stays at a garden, from its intake day, before it may be shared to another garden. */
export const QUARANTINE_DAYS = 30;
/** Lowest germination, in percent, at which a lot may be shared. */
export const SHARING_GERMINATION_FLOOR = 70;

/** What the shelf keeps of a lot between requests. */
export interface LotSnapshot {
  readonly number: string;
  readonly variety: string;
  readonly garden: string;
  readonly grams: number;
  readonly germination: number;
  readonly intake: string;
  readonly cameFrom: string | null;
  readonly log: readonly LogEntry[];
}

export interface Donation {
  readonly donor: string;
  readonly variety: string;
  readonly grams: Grams;
  readonly germination: Germination;
  readonly garden: string;
  readonly on: Day;
}

/**
 * A batch of one seed variety kept at one garden. It never holds less than nothing, and it leaves its garden only
 * after its quarantine and only when it germinates well enough.
 */
export class SeedLot {
  private unsent: LibraryEvent[] = [];

  private constructor(
    readonly number: LotNumber,
    readonly variety: string,
    private kept: string,
    private weight: Grams,
    readonly germination: Germination,
    readonly intake: Day,
    readonly cameFrom: LotNumber | null,
    private history: LogEntry[],
  ) {}

  static donate(number: LotNumber, d: Donation): SeedLot {
    if (d.variety.trim() === '') throw new LibraryRefusal('a lot needs a variety name');
    if (d.garden.trim() === '') throw new LibraryRefusal('a lot needs a garden');
    if (!d.grams.isPositive()) throw new LibraryRefusal('a donation must weigh at least 1 g');
    const lot = new SeedLot(number, d.variety.trim(), d.garden.trim(), d.grams, d.germination, d.on, null, [
      { entry: 'donated', grams: d.grams.value, otherLot: null },
    ]);
    lot.unsent.push(new LotDonated(number.text, d.donor, lot.variety, d.grams.value));
    return lot;
  }

  /** The receiving garden's lot, opened from a delivered share. */
  static receivePortion(shared: PortionShared): SeedLot {
    return new SeedLot(
      LotNumber.of(shared.newLot), shared.variety, shared.toGarden, Grams.of(shared.grams), Germination.of(shared.germination),
      Day.parse(shared.on), LotNumber.of(shared.fromLot), [{ entry: 'shared-in', grams: shared.grams, otherLot: shared.fromLot }],
    );
  }

  static fromSnapshot(s: LotSnapshot): SeedLot {
    return new SeedLot(
      LotNumber.of(s.number), s.variety, s.garden, Grams.of(s.grams), Germination.of(s.germination), Day.parse(s.intake),
      s.cameFrom === null ? null : LotNumber.of(s.cameFrom), [...s.log],
    );
  }

  get garden(): string {
    return this.kept;
  }

  get grams(): Grams {
    return this.weight;
  }

  /** A member takes seed home to sow. */
  handOut(amount: Grams): void {
    this.remove(amount, 'take at least 1 g');
    this.history.push({ entry: 'taken', grams: amount.value, otherLot: null });
  }

  /** Sends part of this lot to another garden as a new lot, which is opened when the event is passed on. */
  shareOut(newLot: LotNumber, toGarden: string, amount: Grams, on: Day): void {
    if (toGarden.trim() === this.kept) throw new LibraryRefusal(`${this.number.text} is already at ${this.kept}`);
    if (toGarden.trim() === '') throw new LibraryRefusal('a share needs a receiving garden');
    if (this.germination.percent < SHARING_GERMINATION_FLOOR) {
      throw new LibraryRefusal(`germination ${String(this.germination.percent)}% is below ${String(SHARING_GERMINATION_FLOOR)}%`);
    }
    if (on.daysSince(this.intake) < QUARANTINE_DAYS) {
      throw new LibraryRefusal(`lot ${this.number.text} is in quarantine until ${this.intake.addDays(QUARANTINE_DAYS).text}`);
    }
    this.remove(amount, 'share at least 1 g');
    this.history.push({ entry: 'shared-out', grams: amount.value, otherLot: newLot.text });
    this.unsent.push(new PortionShared(this.number.text, newLot.text, toGarden.trim(), this.variety, this.germination.percent, amount.value, on.text));
  }

  log(): LogEntry[] {
    return this.history.slice();
  }

  snapshot(): LotSnapshot {
    return {
      number: this.number.text, variety: this.variety, garden: this.kept, grams: this.weight.value,
      germination: this.germination.percent, intake: this.intake.text, cameFrom: this.cameFrom?.text ?? null, log: this.log(),
    };
  }

  /** Hands over the events raised since the last call, once. */
  takeUnsent(): LibraryEvent[] {
    const out = this.unsent;
    this.unsent = [];
    return out;
  }

  private remove(amount: Grams, tooLittle: string): void {
    if (!amount.isPositive()) throw new LibraryRefusal(tooLittle);
    if (amount.exceeds(this.weight)) throw new LibraryRefusal(`not enough seed: ${this.number.text} holds ${this.weight.toString()}`);
    this.weight = this.weight.minus(amount);
  }
}
