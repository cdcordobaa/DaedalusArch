import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { BidPlaced } from './events/BidPlaced';
import { BidderOutbid } from './events/BidderOutbid';
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

export interface LotRecord {
  readonly id: string;
  readonly title: string;
  readonly openingBid: number;
  /** The lowest price the consignor accepts; not shown to bidders. */
  readonly reserve: number;
  readonly status: LotStatus;
  readonly leading: LeadingBid | null;
}

/** One item offered in the sale. A new bid must reach the next step of the ladder above the leading bid. */
export class Lot {
  private constructor(
    readonly id: string,
    readonly title: string,
    readonly openingBid: number,
    readonly reserve: number,
    private status: LotStatus,
    private leading: LeadingBid | null,
  ) {}

  static open(id: string, title: string, openingBid: number, reserve: number): [Lot, DomainEvent[]] {
    if (title.trim() === '') throw new SaleroomError('a lot needs a title');
    if (!Number.isInteger(openingBid) || openingBid <= 0) throw new SaleroomError('the opening bid must be a positive whole amount');
    if (!Number.isInteger(reserve) || reserve < 0) throw new SaleroomError('the reserve must be a whole amount, zero or more');
    return [new Lot(id, title, openingBid, reserve, 'open', null), [new LotOpened(id, title, openingBid)]];
  }

  static fromRecord(r: LotRecord): Lot {
    return new Lot(r.id, r.title, r.openingBid, r.reserve, r.status, r.leading === null ? null : { ...r.leading });
  }

  nextMinimum(): number {
    return this.leading === null ? this.openingBid : BidLadder.stepAbove(this.leading.amount);
  }

  isLedBy(bidderId: string): boolean {
    return this.leading?.bidderId === bidderId;
  }

  /** A bid the bidder's credit does not cover is refused and leaves the lot as it was. */
  bid(bidderId: string, amount: number, creditAvailable: number): { outcome: 'accepted' | 'refused'; events: DomainEvent[] } {
    if (this.status !== 'open') throw new SaleroomError(`lot ${this.id} is closed`);
    if (this.isLedBy(bidderId)) throw new SaleroomError(`${bidderId} already leads lot ${this.id}`);
    const minimum = this.nextMinimum();
    if (!Number.isInteger(amount) || amount < minimum) throw new SaleroomError(`bid must be at least ${String(minimum)}`);
    if (amount > creditAvailable) return { outcome: 'refused', events: [] };
    const outbid = this.leading;
    this.leading = { bidderId, amount };
    const events: DomainEvent[] = [new BidPlaced(this.id, bidderId, amount)];
    if (outbid !== null) events.push(new BidderOutbid(this.id, outbid.bidderId));
    return { outcome: 'accepted', events };
  }

  /** Closing a lot that is already closed changes nothing. */
  close(): DomainEvent[] {
    if (this.status !== 'open') return [];
    if (this.leading !== null && this.leading.amount >= this.reserve) {
      this.status = 'sold';
      return [new LotSold(this.id, this.leading.bidderId, this.leading.amount)];
    }
    this.status = 'unsold';
    return [new LotUnsold(this.id, this.leading?.bidderId ?? null)];
  }

  toRecord(): LotRecord {
    return { id: this.id, title: this.title, openingBid: this.openingBid, reserve: this.reserve, status: this.status, leading: this.leading === null ? null : { ...this.leading } };
  }
}
