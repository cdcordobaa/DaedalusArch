/** An amount in a currency, as shown to the shopper. */
export interface Price {
  readonly currency: string;
  readonly amount: number;
}
