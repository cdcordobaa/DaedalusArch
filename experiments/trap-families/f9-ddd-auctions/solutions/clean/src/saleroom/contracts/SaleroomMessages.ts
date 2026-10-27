/** Messages the saleroom publishes for the rest of the house. */
export interface BidPlacedMessage {
  readonly type: 'BidPlaced';
  readonly lotId: string;
  readonly bidderId: string;
  readonly amount: number;
}

/** A bidder lost the lead on a lot. */
export interface BidderOutbidMessage {
  readonly type: 'BidderOutbid';
  readonly lotId: string;
  readonly bidderId: string;
}

export interface LotSoldMessage {
  readonly type: 'LotSold';
  readonly lotId: string;
  readonly buyerId: string;
  readonly hammerPrice: number;
}

export interface LotUnsoldMessage {
  readonly type: 'LotUnsold';
  readonly lotId: string;
  readonly lastLeaderId: string | null;
}
