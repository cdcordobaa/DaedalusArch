/** Aggregate root of the ordering context. */
export class Order {
  private placed = true;
  private paid = false;
  private invoiced = false;

  constructor(readonly id: string, readonly customerId: string) {}

  markPaid(): void {
    if (!this.placed) throw new Error('Only a placed order can be paid');
    this.paid = true;
  }

  markInvoiced(): void {
    if (!this.placed) throw new Error('Only a placed order can be invoiced');
    this.invoiced = true;
  }

  isPaid(): boolean {
    return this.paid;
  }

  isInvoiced(): boolean {
    return this.invoiced;
  }
}
