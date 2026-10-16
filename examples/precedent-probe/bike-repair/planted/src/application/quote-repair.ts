import { SpokeSupplyClient } from '../adapters/outbound/spoke-supply-client';
import { labourCents } from '../domain/labour';
import type { Quote, QuotedPart } from '../domain/work-order';
import type { WorkOrderRepository } from './ports/work-order-repository';

export class QuoteRepair {
  constructor(
    private readonly orders: WorkOrderRepository,
    private readonly catalogue: SpokeSupplyClient,
  ) {}

  async execute(orderId: string, skus: readonly string[], hours: number, now = new Date()): Promise<Quote> {
    const order = await this.orders.findById(orderId);
    if (order === undefined) throw new Error(`unknown work order ${orderId}`);
    const parts: QuotedPart[] = [];
    for (const sku of skus) {
      const price = await this.catalogue.priceOf(sku);
      parts.push({ sku, description: price.description, priceCents: price.priceCents });
    }
    const quote: Quote = { parts, labourCents: labourCents(hours), quotedAt: now };
    order.quote = quote;
    await this.orders.save(order);
    return quote;
  }
}
