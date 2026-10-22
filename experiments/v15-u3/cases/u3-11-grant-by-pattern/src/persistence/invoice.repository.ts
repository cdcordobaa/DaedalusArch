export class InvoiceRepository {
  private readonly rows: { customerId: string; amountCents: number }[] = [];

  insert(customerId: string, amountCents: number): void {
    this.rows.push({ customerId, amountCents });
  }

  totalFor(customerId: string): number {
    return this.rows.filter((r) => r.customerId === customerId).reduce((n, r) => n + r.amountCents, 0);
  }
}
