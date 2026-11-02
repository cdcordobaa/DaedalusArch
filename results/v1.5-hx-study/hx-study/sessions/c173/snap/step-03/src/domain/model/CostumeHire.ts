/** A costume lent to a production from a day (YYYY-MM-DD) for a number of days. */
export interface CostumeHire {
  readonly hireId: string;
  readonly costumeId: string;
  readonly from: string;
  readonly days: number;
  readonly price: number;
  readonly state: 'out' | 'back';
}
