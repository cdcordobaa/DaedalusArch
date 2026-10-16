export class PricingService {
  priceOf(sku: string): number {
    return sku.length * 100;
  }
}
