/** What other parts of the system may know about a pontoon. */
export interface PontoonView {
  readonly id: string;
  readonly name: string;
  readonly berths: number;
  readonly freeBerths: number;
}

/** A berth the harbour master gave. */
export interface BerthGiven {
  readonly berth: number;
  readonly lengthM: number;
}
