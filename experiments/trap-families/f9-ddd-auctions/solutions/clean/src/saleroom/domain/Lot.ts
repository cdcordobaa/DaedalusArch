import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { BidderOutbid } from './events/BidderOutbid';
import { BidPlaced } from './events/BidPlaced';
import { LeadingBidStruck } from './events/LeadingBidStruck';
import { LotOpened } from './events/LotOpened';
import { LotSold } from './events/LotSold';
import { LotUnsold } from './events/LotUnsold';
import { SaleroomError } from './SaleroomError';
import { BidLadder } from './value-objects/BidLadder';

export type LotStatus = 'open' | 'sold' | 'unsold';

export interface LeadingBid {
  readonly bidderId: string;
  readonly amount: number;
}

/** What the lot is told about a bidder when the bid comes in. */
export interface BidderStanding {
  readonly creditAvailable: number;
  readonly suspended: boolean;
}

export interface BidOutcome {
  readonly result: 'accepted' | 'refused';
  readonly events: DomainEvent[];
}

export interface LotRecord {
  readonly id: string;
  readonly title: string;
  readonly openingBid: number;
  /** The lowest price the consignor accepts; not shown to bidders. */
  readonly reserve: number;
  readonly status: LotStatus;
  readonly leading: LeadingBid | null;
  readonly buyer: string | null;
}

/**
 * One item offered in the sale. A new bid must reach the next step of the ladder above the leading bid and be covered
 * by the bidder's credit; the hammer sells the lot to the leader when the leading bid reaches the reserve.
 */
export class Lot {
  private constructor(
    readonly id: string,
    readonly title: string,
    readonly openingBid: number,
    readonly reserve: number,
    private status: LotStatus,
    private leading: LeadingBid | null,
    private buyer: string | null,
  ) {}

  static open(id: string, title: string, openingBid: number, reserve: number): [Lot, DomainEvent[]] {
    if (title.trim() === '') throw new SaleroomError('a lot needs a title');
    if (!Number.isInteger(openingBid) || openingBid <= 0) throw new SaleroomError('the opening bid must be a positive whole amount');
    if (!Number.isInteger(reserve) || reserve < 0) throw new SaleroomError('the reserve must be a whole amount, zero or more');
    return [new Lot(id, title, openingBid, reserve, 'open', null, null), [new LotOpened(id, title, openingBid)]];
  }

  static fromRecord(r: LotRecord): Lot {
    return new Lot(r.id, r.title, r.openingBid, r.reserve, r.status, r.leading === null ? null : { ...r.leading }, r.buyer);
  }

  nextMinimum(): number {
    return this.leading === null ? this.openingBid : BidLadder.stepAbove(this.leading.amount);
  }

  isLedBy(bidderId: string): boolean {
    return this.leading?.bidderId === bidderId;
  }

  isOpen(): boolean {
    return this.status === 'open';
  }

  bid(bidderId: string, amount: number, standing: BidderStanding): BidOutcome {
    if (!this.isOpen()) throw new SaleroomError(`lot ${this.id} is closed`);
    if (standing.suspended) throw new SaleroomError(`account ${bidderId} is suspended`);
    if (this.isLedBy(bidderId)) throw new SaleroomError(`${bidderId} already leads lot ${this.id}`);
    const minimum = this.nextMinimum();
    if (!Number.isInteger(amount) || amount < minimum) throw new SaleroomError(`bid must be at least ${String(minimum)}`);
    if (amount > standing.creditAvailable) return { result: 'refused', events: [] };
    const outbid = this.leading;
    this.leading = { bidderId, amount };
    const events: DomainEvent[] = [new BidPlaced(this.id, bidderId, amount)];
    if (outbid !== null) events.push(new BidderOutbid(this.id, outbid.bidderId));
    return { result: 'accepted', events };
  }

  /** The hammer falls. Closing a closed lot changes nothing. */
  close(): DomainEvent[] {
    if (!this.isOpen()) return [];
    const last = this.leading;
    if (last !== null && last.amount >= this.reserve) {
      this.status = 'sold';
      this.buyer = last.bidderId;
      return [new LotSold(this.id, last.bidderId, last.amount)];
    }
    this.status = 'unsold';
    return [new LotUnsold(this.id, last?.bidderId ?? null)];
  }

  /** Strikes the leading bid of a bidder who may no longer bid; the lot opens again from its opening bid. */
  strikeLeaderIf(bidderId: string): DomainEvent[] {
    if (!this.isOpen() || this.leading === null || this.leading.bidderId !== bidderId) return [];
    const struck = this.leading;
    this.leading = null;
    return [new LeadingBidStruck(this.id, struck.bidderId, struck.amount)];
  }

  toRecord(): LotRecord {
    return { id: this.id, title: this.title, openingBid: this.openingBid, reserve: this.reserve, status: this.status, leading: this.leading === null ? null : { ...this.leading }, buyer: this.buyer };
  }
}
