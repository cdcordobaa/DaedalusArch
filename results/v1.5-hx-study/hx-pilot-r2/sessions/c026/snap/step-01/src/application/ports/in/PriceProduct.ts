export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** Absent when no usable rate exists; see reason. */
  readonly amount?: number;
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
