/** Messages the saleroom publishes for the rest of the house. */
export interface BidPlacedMessage {
  readonly type: 'BidPlaced';
  readonly lotId: string;
  readonly bidderId: string;
  readonly amount: number;
  /** The bidder who led the lot until this bid, if any. */
  readonly previousBidderId: string | null;
}
