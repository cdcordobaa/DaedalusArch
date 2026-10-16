export interface PartPrice {
  readonly sku: string;
  readonly description: string;
  readonly priceCents: number;
  readonly inStock: boolean;
}

export interface PartsCatalogue {
  priceOf(sku: string): Promise<PartPrice>;
}
