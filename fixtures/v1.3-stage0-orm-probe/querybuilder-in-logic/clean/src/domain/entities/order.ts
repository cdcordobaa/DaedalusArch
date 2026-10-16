export class Order {
  private constructor(
    readonly id: string,
    readonly customerId: string,
    readonly totalCents: number,
  ) {}

  static create(id: string, customerId: string, totalCents: number): Order {
    if (totalCents < 0) throw new Error('total must be non-negative');
    return new Order(id, customerId, totalCents);
  }

  isLarge(): boolean {
    return this.totalCents >= 100_000;
  }
}
