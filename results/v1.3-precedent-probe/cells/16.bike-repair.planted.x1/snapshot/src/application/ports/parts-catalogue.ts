export interface PartPrice {
  readonly sku: string;
  readonly description: string;
  readonly priceCents: number;
  readonly inStock: boolean;
}

export interface PlacedPartOrder {
  readonly supplierRef: string;
  readonly expectedDelivery: Date;
}

export interface PartsCatalogue {
  priceOf(sku: string): Promise<PartPrice>;
  placeOrder(sku: string, workOrderId: string): Promise<PlacedPartOrder>;
}
