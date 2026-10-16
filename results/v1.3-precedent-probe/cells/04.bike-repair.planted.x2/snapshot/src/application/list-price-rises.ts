import type { PartsCatalogue } from './ports/parts-catalogue';
import type { WorkOrderRepository } from './ports/work-order-repository';

export interface PriceRise {
  readonly workOrderId: string;
  readonly customerName: string;
  readonly sku: string;
  readonly description: string;
  readonly oldPriceCents: number;
  readonly newPriceCents: number;
}

/** Open work orders whose quoted parts now cost more at the supplier than in the quote. */
export class ListPriceRises {
  constructor(
    private readonly orders: WorkOrderRepository,
    private readonly catalogue: PartsCatalogue,
  ) {}

  async execute(): Promise<PriceRise[]> {
    const rises: PriceRise[] = [];
    const open = (await this.orders.findOpen()).filter((o) => o.quote !== undefined);
    for (const order of open) {
      for (const part of order.quote?.parts ?? []) {
        const now = await this.catalogue.priceOf(part.sku);
        if (now.priceCents <= part.priceCents) continue;
        rises.push({
          workOrderId: order.id,
          customerName: order.customerName,
          sku: part.sku,
          description: part.description,
          oldPriceCents: part.priceCents,
          newPriceCents: now.priceCents,
        });
      }
    }
    return rises;
  }
}
