/** The house's bidding steps: 50 while the bid is under 1,000, then 100. */
export class BidLadder {
  private constructor() {}

  static stepAbove(amount: number): number {
    return amount + (amount < 1000 ? 50 : 100);
  }
}
