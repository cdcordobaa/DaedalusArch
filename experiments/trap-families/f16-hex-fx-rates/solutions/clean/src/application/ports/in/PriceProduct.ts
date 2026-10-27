export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  /** Absent when the price cannot be shown in this currency. */
  readonly amount?: number;
  readonly estimated?: boolean;
  /** For the shopper when there is no amount. */
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
