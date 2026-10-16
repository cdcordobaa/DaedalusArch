import type { PartPrice, PartsCatalogue, SupplierOrder } from '../../application/ports/parts-catalogue';

/** SpokeSupply wholesale API. No network in this service yet: a fixed price list stands in for the HTTP call. */
export class SpokeSupplyClient implements PartsCatalogue {
  private readonly prices = new Map<string, { description: string; cents: number; stock: number }>([
    ['CH-9SPD', { description: '9-speed chain', cents: 2199, stock: 14 }],
    ['BP-RIM', { description: 'rim brake pads (pair)', cents: 899, stock: 40 }],
    ['TB-700C', { description: '700c inner tube', cents: 649, stock: 0 }],
  ]);

  constructor(private readonly baseUrl = 'https://api.spokesupply.example/v2') {}

  async priceOf(sku: string): Promise<PartPrice> {
    const row = this.prices.get(sku);
    if (row === undefined) throw new Error(`SpokeSupply (${this.baseUrl}) does not list ${sku}`);
    return { sku, description: row.description, priceCents: row.cents, inStock: row.stock > 0 };
  }

  async orderPart(sku: string, quantity: number, reference: string): Promise<SupplierOrder> {
    const row = this.prices.get(sku);
    if (row === undefined) throw new Error(`SpokeSupply (${this.baseUrl}) does not list ${sku}`);
    if (quantity < 1) throw new Error('SpokeSupply: quantity must be at least 1');
    const days = row.stock >= quantity ? 2 : 7;
    const expectedDelivery = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return { orderRef: `SS-${reference}-${sku}`, expectedDelivery };
  }
}
