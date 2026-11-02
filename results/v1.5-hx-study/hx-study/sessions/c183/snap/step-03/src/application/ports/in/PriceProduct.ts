export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** null when no usable rate exists; see reason. */
  readonly amount: number | null;
  /** true when the amount comes from an earlier rate because Ratewise was unavailable. */
  readonly estimated: boolean;
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
