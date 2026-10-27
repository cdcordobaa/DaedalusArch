import type { BidderStanding } from '../../domain/Lot';

/** What the saleroom needs to know about bidders. */
export interface Bidders {
  /** Undefined for an unknown bidder. */
  standing(bidderId: string): BidderStanding | undefined;
}
