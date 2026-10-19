export interface OrderLine {
  readonly sku: string;
  readonly price: number;
  readonly quantity: number;
}

export class Order {
  constructor(
    readonly id: string,
    readonly customerEmail: string,
    readonly lines: readonly OrderLine[],
  ) {}

  subtotal(): number {
    return this.lines.reduce((acc, l) => acc + l.price * l.quantity, 0);
  }
}
