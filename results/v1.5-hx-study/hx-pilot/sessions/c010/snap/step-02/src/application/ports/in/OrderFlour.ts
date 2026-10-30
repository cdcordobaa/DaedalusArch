export interface OrderRequest {
  readonly orderId: string;
  readonly sku: string;
  readonly bags: number;
  /** The delivery day, YYYY-MM-DD. */
  readonly deliverOn: string;
}

export interface OrderView {
  readonly orderId: string;
  readonly status: string;
  readonly supplierOrderNo?: string;
  readonly total?: number;
  /** With status 'sold_out': the cheapest other flour of the same grade that is in stock, or null. */
  readonly alternative?: string | null;
  /** With status 'too_small': the euros the order still lacks to reach the minimum, or null when unknown. */
  readonly missing?: number | null;
}

export interface FlourView {
  readonly sku: string;
  readonly name: string;
  readonly grade: string;
  readonly bagsInStock: number;
  readonly pricePerBag: number;
}

export interface OrderFlour {
  flours(): Promise<FlourView[]>;
  order(request: OrderRequest): Promise<OrderView>;
}
