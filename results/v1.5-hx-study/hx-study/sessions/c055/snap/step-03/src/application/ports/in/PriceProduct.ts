export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** null when no usable exchange rate is available; see `reason`. */
  readonly amount: number | null;
  readonly reason?: string;
  /** true when the amount uses an earlier Ratewise rate because Ratewise was unavailable. */
  readonly estimated: boolean;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
