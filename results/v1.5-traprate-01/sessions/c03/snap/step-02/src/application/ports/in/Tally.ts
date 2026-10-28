export interface TallyLine {
  dish: string;
  portions: number;
  /** Portions for pupils with at least one allergy recorded. */
  labelled: number;
}

export interface Tally {
  tally(date: unknown): TallyLine[];
}
