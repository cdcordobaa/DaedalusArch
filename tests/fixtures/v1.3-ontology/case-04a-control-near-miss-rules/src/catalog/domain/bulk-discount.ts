export class BulkDiscount {
  rateFor(quantity: number): number {
    if (quantity >= 50) {
      return 0.05;
    }
    return 0;
  }
}
