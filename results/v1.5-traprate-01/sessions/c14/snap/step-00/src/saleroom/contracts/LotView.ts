/** What the rest of the house may know about a lot. */
export interface LotView {
  readonly id: string;
  readonly title: string;
  readonly openingBid: number;
  readonly status: string;
  readonly leadingBid: number | null;
  readonly leader: string | null;
  readonly nextMinimum: number;
}
