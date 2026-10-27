export interface TallyLine {
  dish: string;
  portions: number;
  labelled: number;
}

export interface KitchenTally {
  /** The meals to cook on a day, per dish, most portions first. */
  tally(date: unknown): TallyLine[];
}
