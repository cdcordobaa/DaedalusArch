export interface TallyLine {
  dish: string;
  portions: number;
  labelled: number;
}

export interface Kitchen {
  tally(date: unknown): TallyLine[];
}
