export class Order {
  private constructor(
    readonly id: string,
    readonly sku: string,
    readonly quantity: number,
  ) {}

  static create(id: string, sku: string, quantity: number): Order {
    return new Order(id, sku, quantity);
  }
}
