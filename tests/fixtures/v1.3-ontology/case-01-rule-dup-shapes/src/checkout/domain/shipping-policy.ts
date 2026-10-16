export interface CartLine {
  readonly sku: string;
  readonly unitPrice: number;
  readonly quantity: number;
}

/** Shipping charged at checkout. */
export class ShippingPolicy {
  private readonly flatRate = 4.99;

  shippingFor(lines: readonly CartLine[]): number {
    const total = lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
    if (total >= 50) {
      return 0;
    }
    return this.flatRate;
  }
}
