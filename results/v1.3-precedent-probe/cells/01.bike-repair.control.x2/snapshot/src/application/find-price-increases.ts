import type { PartsCatalogue } from './ports/parts-catalogue';
import type { WorkOrderRepository } from './ports/work-order-repository';

export interface PriceIncrease {
  readonly workOrderId: string;
  readonly customerName: string;
  readonly bike: string;
  readonly sku: string;
  readonly description: string;
  readonly quotedCents: number;
  readonly currentCents: number;
}

export class FindPriceIncreases {
  constructor(
    private readonly orders: WorkOrderRepository,
    private readonly catalogue: PartsCatalogue,
  ) {}

  async execute(): Promise<PriceIncrease[]> {
    const rows: PriceIncrease[] = [];
    for (const order of await this.orders.findOpen()) {
      if (order.quote === undefined) continue;
      for (const part of order.quote.parts) {
        const current = await this.catalogue.priceOf(part.sku);
        if (current.priceCents > part.priceCents) {
          rows.push({
            workOrderId: order.id,
            customerName: order.customerName,
            bike: order.bike,
            sku: part.sku,
            description: part.description,
            quotedCents: part.priceCents,
            currentCents: current.priceCents,
          });
        }
      }
    }
    return rows;
  }
}
