export interface PartPrice {
  readonly sku: string;
  readonly description: string;
  readonly priceCents: number;
  readonly inStock: boolean;
}

export interface SupplierOrder {
  readonly orderRef: string;
  readonly expectedDelivery: Date;
}

export interface PartsCatalogue {
  priceOf(sku: string): Promise<PartPrice>;
  orderPart(sku: string, quantity: number, reference: string): Promise<SupplierOrder>;
}
