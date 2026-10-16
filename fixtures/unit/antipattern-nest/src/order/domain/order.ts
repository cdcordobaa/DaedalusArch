export type OrderStatus = 'open' | 'paid' | 'cancelled';

export class Order {
  status: OrderStatus = 'open';

  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly total: number,
  ) {}

  pay(): void {
    if (this.status !== 'open') {
      throw new Error('Only open orders can be paid');
    }
    this.status = 'paid';
  }

  isPaid(): boolean {
    return this.status === 'paid';
  }
}
