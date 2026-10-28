export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** Null when no usable rate exists; see reason. */
  readonly amount: number | null;
  readonly estimated?: boolean;
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
