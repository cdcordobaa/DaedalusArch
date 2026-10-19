export class Order {
  private constructor(
    readonly id: string,
    readonly sku: string,
    readonly quantity: number,
    readonly giftNote: string,
  ) {}

  static create(id: string, sku: string, quantity: number, giftNote: string): Order {
    return new Order(id, sku, quantity, giftNote);
  }
}
