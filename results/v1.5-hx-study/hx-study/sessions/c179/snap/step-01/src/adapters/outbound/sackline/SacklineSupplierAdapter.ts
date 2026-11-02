import { SacklineError, type SacklineClient } from 'sackline-sdk';
import type { Flour } from '../../../domain/model/Flour';
import { SoldOut } from '../../../domain/errors/SoldOut';
import { SupplyRefused } from '../../../domain/errors/SupplyRefused';
import type { Supplier } from '../../../application/ports/out/Supplier';

export class SacklineSupplierAdapter implements Supplier {
  constructor(private readonly client: SacklineClient) {}

  async flours(): Promise<Flour[]> {
    return (await this.client.products()).map((p) => ({ sku: p.sku, name: p.name, grade: p.grade, bagsInStock: p.stockBags, pricePerBag: p.priceCents / 100 }));
  }

  async place(sku: string, bags: number, deliverOn: string, orderId: string): Promise<{ supplierOrderNo: string; total: number }> {
    try {
      const o = await this.client.placeOrder({ sku, bags, deliverOn, poRef: orderId });
      return { supplierOrderNo: o.orderNo, total: o.totalCents / 100 };
    } catch (e) {
      if (e instanceof SacklineError && e.code === 'OUT_OF_STOCK') throw new SoldOut(sku);
      if (e instanceof SacklineError) throw new SupplyRefused(e.code);
      throw e;
    }
  }
}
