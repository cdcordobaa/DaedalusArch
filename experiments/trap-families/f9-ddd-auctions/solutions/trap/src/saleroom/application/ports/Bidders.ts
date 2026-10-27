/** What the saleroom needs to know about bidders. */
export interface Bidders {
  isRegistered(bidderId: string): boolean;
  isSuspended(bidderId: string): boolean;
  holdCredit(bidderId: string, ref: string, amount: number): void;
  releaseCredit(bidderId: string, ref: string): void;
  recordPurchase(bidderId: string, lotId: string, hammerPrice: number): void;
}
