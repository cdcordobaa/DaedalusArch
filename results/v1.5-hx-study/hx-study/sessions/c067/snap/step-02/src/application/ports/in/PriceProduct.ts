export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** Absent when no usable exchange rate exists; see reason. */
  readonly amount?: number;
  readonly reason?: string;
  /** True when the amount comes from an earlier rate because the provider was unavailable. */
  readonly estimated: boolean;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
