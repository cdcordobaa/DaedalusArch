/** A request to lend a painting to another museum. */
export interface LoanRequest {
  readonly id: string;
  readonly text: string;
  readonly at: string;
}
