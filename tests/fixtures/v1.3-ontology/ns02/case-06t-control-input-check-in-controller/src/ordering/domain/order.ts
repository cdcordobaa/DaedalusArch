/** Purchase limit: no customer may order more than 20 units of one SKU in a single order. */
const MAX_UNITS_PER_ORDER = 20;

export class OrderLimitError extends Error {}

export class Order {
  private constructor(
    readonly id: string,
    readonly sku: string,
    readonly quantity: number,
  ) {}

  static create(id: string, sku: string, quantity: number): Order {
    if (quantity > MAX_UNITS_PER_ORDER) {
      throw new OrderLimitError(`at most ${String(MAX_UNITS_PER_ORDER)} units per order`);
    }
    return new Order(id, sku, quantity);
  }
}
