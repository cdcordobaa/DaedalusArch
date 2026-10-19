class OrderStore {
  private readonly rows: string[] = [];

  save(id: string): void {
    this.rows.push(id);
  }

  all(): readonly string[] {
    return this.rows;
  }
}

export function renderOrders(store: OrderStore): string {
  return store.all().join(', ');
}
