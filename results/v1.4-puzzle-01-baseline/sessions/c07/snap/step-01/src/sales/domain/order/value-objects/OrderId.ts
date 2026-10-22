export class OrderId {
  private constructor(readonly value: string) {}

  static of(value: string): OrderId {
    if (value.trim() === '') throw new Error('order id must not be empty');
    return new OrderId(value);
  }
}
