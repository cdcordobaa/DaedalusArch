export interface OrderLineRecord {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderRecord {
  id: string;
  customerId: string;
  status: 'placed' | 'cancelled';
  createdAt: string;
  discountCents: number;
  lines: OrderLineRecord[];
}
