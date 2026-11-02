/** A narrowboat hired from a day (YYYY-MM-DD) for a number of nights; the price is in pounds. */
export interface Hire {
  readonly hireId: string;
  readonly boatId: string;
  readonly from: string;
  readonly nights: number;
  readonly hirerRef: string;
  readonly quoteRef: string;
  readonly price: number;
  readonly state: 'reserved' | 'on_water' | 'returned';
  readonly policyNo?: string;
}
