/** What the saleroom needs to know about bidders. */
export interface Bidders {
  isRegistered(bidderId: string): boolean;
}
