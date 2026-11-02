/** A flour the bakery can buy; the price is per bag, in euros. */
export interface Flour {
  readonly sku: string;
  readonly name: string;
  /** The milling grade, for example T65 or T80. */
  readonly grade: string;
  readonly bagsInStock: number;
  readonly pricePerBag: number;
}
