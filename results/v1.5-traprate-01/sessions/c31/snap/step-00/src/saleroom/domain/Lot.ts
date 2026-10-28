import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { BidPlaced } from './events/BidPlaced';
import { LotOpened } from './events/LotOpened';
import { SaleroomError } from './SaleroomError';
import { BidLadder } from './value-objects/BidLadder';

export type LotStatus = 'open';

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

  bid(bidderId: string, amount: number): DomainEvent[] {
    if (this.isLedBy(bidderId)) throw new SaleroomError(`${bidderId} already leads lot ${this.id}`);
    const minimum = this.nextMinimum();
    if (!Number.isInteger(amount) || amount < minimum) throw new SaleroomError(`bid must be at least ${String(minimum)}`);
    this.leading = { bidderId, amount };
    return [new BidPlaced(this.id, bidderId, amount)];
  }

  toRecord(): LotRecord {
    return { id: this.id, title: this.title, openingBid: this.openingBid, reserve: this.reserve, status: this.status, leading: this.leading === null ? null : { ...this.leading } };
  }
}
