export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** Null when no usable exchange rate exists; see reason. */
  readonly amount: number | null;
  /** True when the amount uses an earlier Ratewise rate because Ratewise was unavailable. */
  readonly estimated: boolean;
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
