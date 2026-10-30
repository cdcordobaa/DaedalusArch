export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** Absent when no usable rate exists; see reason. */
  readonly amount?: number;
  /** True when the amount uses an earlier Ratewise rate because Ratewise was unavailable. */
  readonly estimated?: boolean;
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
