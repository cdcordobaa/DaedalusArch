export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  readonly amount: number;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
