export class DiscountPolicy {
  rateFor(listPrice: number): number {
    return listPrice >= 1000 ? 0.05 : 0;
  }
}
