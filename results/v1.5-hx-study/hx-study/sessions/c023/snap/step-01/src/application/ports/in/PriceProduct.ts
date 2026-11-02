export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** null when no amount can be given; see reason. */
  readonly amount: number | null;
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
