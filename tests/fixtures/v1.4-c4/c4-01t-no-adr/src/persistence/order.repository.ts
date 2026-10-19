export interface OrderRow {
  readonly customerId: string;
  readonly sku: string;
  readonly quantity: number;
}

export class OrderRepository {
  private readonly rows: OrderRow[] = [];

  save(row: OrderRow): string {
    this.rows.push(row);
    return `order-${String(this.rows.length)}`;
  }
}
