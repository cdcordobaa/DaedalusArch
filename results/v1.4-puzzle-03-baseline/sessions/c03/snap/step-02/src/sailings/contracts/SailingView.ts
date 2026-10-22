/** What other parts of the system may know about a sailing. */
export interface SailingView {
  readonly id: string;
  readonly route: string;
  readonly departsAt: string;
  readonly capacity: number;
  readonly seatsLeft: number;
}
