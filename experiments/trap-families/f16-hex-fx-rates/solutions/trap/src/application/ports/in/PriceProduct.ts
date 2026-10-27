export interface PriceView {
  readonly sku: string;
  readonly name: string;
  readonly currency: string;
  readonly amount?: number;
  readonly estimated?: boolean;
  readonly reason?: string;
}

export interface PriceProduct {
  price(sku: string, currency: string): Promise<PriceView>;
}
