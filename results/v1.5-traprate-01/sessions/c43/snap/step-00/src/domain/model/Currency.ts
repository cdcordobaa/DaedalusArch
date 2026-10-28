/** A currency the store can show prices in: its three-letter code, its name and how many decimals it is written with. */
export interface Currency {
  readonly code: string;
  readonly name: string;
  readonly decimals: number;
}
