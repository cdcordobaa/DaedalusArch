export class ShipmentRepository {
  private readonly rows = new Map<string, { orderId: string; status: 'pending' | 'shipped' | 'returned' }>();

  insert(orderId: string): string {
    const id = `shp-${String(this.rows.size + 1)}`;
    this.rows.set(id, { orderId, status: 'pending' });
    return id;
  }

  findStatus(shipmentId: string): string | null {
    return this.rows.get(shipmentId)?.status ?? null;
  }

  markReturned(shipmentId: string): void {
    const row = this.rows.get(shipmentId);
    if (row !== undefined) row.status = 'returned';
  }
}
