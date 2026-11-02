/** A product the store sells, priced in euro cents. */
export interface Product {
  readonly sku: string;
  readonly name: string;
  readonly euroCents: number;
}
