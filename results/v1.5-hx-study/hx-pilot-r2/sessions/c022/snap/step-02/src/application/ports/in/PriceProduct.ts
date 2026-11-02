export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  readonly amount: number | null;
  readonly estimated?: boolean;
  /** Set when amount is null. */
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
