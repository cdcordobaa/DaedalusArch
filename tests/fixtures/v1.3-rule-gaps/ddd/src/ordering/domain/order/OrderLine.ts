import { PricingService } from '../services/PricingService';

// violating (aggregate-holds-service): an inner entity holds a domain service.
export class OrderLine {
  constructor(readonly sku: string, private readonly pricing: PricingService) {}
  price(): number {
    return this.pricing.priceOf(this.sku);
  }
}
