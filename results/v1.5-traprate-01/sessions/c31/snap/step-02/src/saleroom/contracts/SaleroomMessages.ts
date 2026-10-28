/** Messages the saleroom publishes for the rest of the house. */
export interface BidPlacedMessage {
  readonly type: 'BidPlaced';
  readonly lotId: string;
  readonly bidderId: string;
  readonly amount: number;
}

/** The hammer came down on the lot with its leading bid at or above the reserve. */
export interface LotSoldMessage {
  readonly type: 'LotSold';
  readonly lotId: string;
  readonly bidderId: string;
  readonly amount: number;
}

/** The lot closed without a sale; the leading bidder, if any, is named. */
export interface LotUnsoldMessage {
  readonly type: 'LotUnsold';
  readonly lotId: string;
  readonly bidderId: string | null;
}

/** The bidder who led the lot until now no longer does. */
export interface BidderOutbidMessage {
  readonly type: 'BidderOutbid';
  readonly lotId: string;
  readonly bidderId: string;
}
