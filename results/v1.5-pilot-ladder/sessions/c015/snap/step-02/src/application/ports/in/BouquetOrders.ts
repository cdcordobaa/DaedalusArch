export interface OrderRequest {
  readonly orderId: string;
  readonly recipient: string;
  readonly street: string;
  readonly postcode: string;
  readonly city: string;
  readonly message: string;
  readonly withWine: boolean;
}

export interface OrderView {
  readonly orderId: string;
  readonly status: string;
  readonly trackingCode?: string;
}

export interface BouquetOrders {
  place(request: OrderRequest): Promise<OrderView>;
  send(orderId: string): Promise<OrderView>;
  status(orderId: string): Promise<OrderView>;
  changeMessage(orderId: string, message: string): Promise<OrderView>;
  lastSeen(orderId: string): Promise<string>;
}
