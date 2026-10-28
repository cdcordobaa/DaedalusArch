import type { VendorId } from './value-objects/VendorId';

export type LicenceStatus = 'full' | 'basic' | 'suspended';

/** Inspection score from which a vendor holds a full licence (may trade prepared food). */
const FULL_LICENCE_FROM_SCORE = 75;
/** Strikes at which the licence is suspended. */
const SUSPENDED_AT_STRIKES = 3;

export interface VendorSnapshot {
  readonly id: VendorId;
  readonly tradingName: string;
  readonly inspectionScore: number | null;
  readonly strikes: number;
  readonly lastTraded: string | null;
}

/**
 * A licensed market vendor. The licence status follows from the record: suspended at three strikes, otherwise full
 * from an inspection score of 75, otherwise basic (also before any inspection).
 */
export class Vendor {
  private constructor(
    readonly id: VendorId,
    readonly tradingName: string,
    private score: number | null,
    private strikeCount: number,
    private lastTradedOn: string | null,
  ) {}

  static register(id: VendorId, tradingName: string): Vendor {
    if (tradingName.trim() === '') throw new Error('a vendor needs a trading name');
    return new Vendor(id, tradingName.trim(), null, 0, null);
  }

  static fromSnapshot(s: VendorSnapshot): Vendor {
    return new Vendor(s.id, s.tradingName, s.inspectionScore, s.strikes, s.lastTraded);
  }

  get inspectionScore(): number | null {
    return this.score;
  }

  get strikes(): number {
    return this.strikeCount;
  }

  get lastTraded(): string | null {
    return this.lastTradedOn;
  }

  licenceStatus(): LicenceStatus {
    if (this.strikeCount >= SUSPENDED_AT_STRIKES) return 'suspended';
    if (this.score !== null && this.score >= FULL_LICENCE_FROM_SCORE) return 'full';
    return 'basic';
  }

  /** The latest inspection replaces the earlier score. */
  recordInspection(score: number): void {
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('inspection score must be a whole number from 0 to 100');
    this.score = score;
  }

  /** A strike given by the market manager (complaints, rule breaches). */
  addStrike(): void {
    this.strikeCount += 1;
  }

  /** The vendor traded on this date (kept only when it is the latest). */
  noteTrading(date: string): void {
    if (this.lastTradedOn === null || date > this.lastTradedOn) this.lastTradedOn = date;
  }

  snapshot(): VendorSnapshot {
    return { id: this.id, tradingName: this.tradingName, inspectionScore: this.score, strikes: this.strikeCount, lastTraded: this.lastTradedOn };
  }
}
