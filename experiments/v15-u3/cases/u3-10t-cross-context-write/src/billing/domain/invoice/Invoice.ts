export class Invoice {
  private totalCents = 0;
  private paid = false;

  constructor(readonly id: string, readonly orderId: string) {}

  addLine(cents: number): void {
    this.totalCents += cents;
  }

  markPaid(): void {
    this.paid = true;
  }

  isPaid(): boolean {
    return this.paid;
  }
}
