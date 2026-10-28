/** Messages the saleroom publishes for the rest of the house. */
export interface BidPlacedMessage {
  readonly type: 'BidPlaced';
  readonly lotId: string;
  readonly bidderId: string;
  readonly amount: number;
  /** The bidder who led the lot until this bid, if any. */
  readonly previousBidderId: string | null;
}

export interface LotClosedMessage {
  readonly type: 'LotClosed';
  readonly lotId: string;
  readonly outcome: 'sold' | 'unsold';
  /** The leading bidder when the hammer fell, if any; the buyer when the lot is sold. */
  readonly bidderId: string | null;
  /** The hammer price, or the leading bid when unsold. */
  readonly amount: number;
}
