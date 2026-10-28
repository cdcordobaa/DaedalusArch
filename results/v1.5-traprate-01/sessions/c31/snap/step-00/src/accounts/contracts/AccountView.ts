/** What the rest of the house may know about a bidder's account. */
export interface AccountView {
  readonly id: string;
  readonly name: string;
  readonly creditLimit: number;
  readonly creditAvailable: number;
  readonly bidsPlaced: number;
  readonly status: string;
}
