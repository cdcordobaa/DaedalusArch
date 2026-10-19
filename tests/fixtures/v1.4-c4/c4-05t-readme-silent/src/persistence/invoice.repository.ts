export class InvoiceRepository {
  private readonly rows = new Map<string, { customerId: string; amountCents: number; cancelled: boolean }>();

  insert(customerId: string, amountCents: number): string {
    const id = `inv-${String(this.rows.size + 1)}`;
    this.rows.set(id, { customerId, amountCents, cancelled: false });
    return id;
  }

  markCancelled(invoiceId: string): void {
    const row = this.rows.get(invoiceId);
    if (row !== undefined) row.cancelled = true;
  }
}
