export class FreeShippingRule {
  costFor(orderTotal: number, baseCost: number): number {
    if (orderTotal >= 50) {
      return 0;
    }
    return baseCost;
  }
}
