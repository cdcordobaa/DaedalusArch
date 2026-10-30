import type { FlourOrder } from '../../domain/model/FlourOrder';
import { BakeryError } from '../../domain/errors/BakeryError';
import { BelowMinimum } from '../../domain/errors/BelowMinimum';
import { FlourSoldOut } from '../../domain/errors/FlourSoldOut';
import { OrderRules } from '../../domain/services/OrderRules';
import type { FlourView, OrderFlour, OrderRequest, OrderView } from '../ports/in/OrderFlour';
import type { FlourOrders } from '../ports/out/FlourOrders';
import type { Supplier } from '../ports/out/Supplier';

export class OrderFlourService implements OrderFlour {
  constructor(
    private readonly supplier: Supplier,
    private readonly orders: FlourOrders,
    private readonly rules: OrderRules = new OrderRules(),
  ) {}

  async flours(): Promise<FlourView[]> {
    const all = await this.supplier.flours();
    return [...all].sort((a, b) => a.grade.localeCompare(b.grade) || a.name.localeCompare(b.name));
  }

  async order(r: OrderRequest): Promise<OrderView> {
    const bags = this.rules.bags(r.bags);
    const deliverOn = this.rules.day(r.deliverOn);
    const weekday = new Date(deliverOn + 'T12:00:00Z').getUTCDay();
    if (weekday === 0 || weekday === 6) throw new BakeryError('We take deliveries Monday to Friday only.');
    let placed: { supplierOrderNo: string; total: number };
    try {
      placed = await this.supplier.place(r.sku, bags, deliverOn, r.orderId);
    } catch (e) {
      if (e instanceof FlourSoldOut) return { orderId: r.orderId, status: 'sold_out', alternative: await this.alternative(r.sku, bags) };
      if (e instanceof BelowMinimum) return { orderId: r.orderId, status: 'too_small', missing: e.missing };
      throw e;
    }
    const order: FlourOrder = { orderId: r.orderId, sku: r.sku, bags, deliverOn, supplierOrderNo: placed.supplierOrderNo, total: placed.total };
    await this.orders.save(order);
    return { orderId: r.orderId, status: 'placed', supplierOrderNo: order.supplierOrderNo, total: order.total };
  }

  /** The cheapest other flour of the same grade with at least that many bags in stock. */
  private async alternative(sku: string, bags: number): Promise<string | null> {
    const all = await this.supplier.flours();
    const grade = all.find((f) => f.sku === sku)?.grade;
    const other = all.filter((f) => f.grade === grade && f.sku !== sku && f.bagsInStock >= bags).sort((a, b) => a.pricePerBag - b.pricePerBag);
    return other[0]?.sku ?? null;
  }
}
