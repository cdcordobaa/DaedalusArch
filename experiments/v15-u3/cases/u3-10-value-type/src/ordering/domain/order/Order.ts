export class Order {
  private status: 'open' | 'paid' = 'open';

  constructor(readonly id: string) {}

  markPaid(): void {
    this.status = 'paid';
  }
}
