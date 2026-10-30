import type { FlourOrder } from '../../domain/model/FlourOrder';
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
    const placed = await this.supplier.place(r.sku, bags, deliverOn, r.orderId);
    if (placed.soldOut) return { orderId: r.orderId, status: 'sold_out', alternative: await this.alternative(r.sku, bags) };
    const order: FlourOrder = { orderId: r.orderId, sku: r.sku, bags, deliverOn, supplierOrderNo: placed.supplierOrderNo, total: placed.total };
    await this.orders.save(order);
    return { orderId: r.orderId, status: 'placed', supplierOrderNo: order.supplierOrderNo, total: order.total };
  }

  private async alternative(sku: string, bags: number): Promise<string | null> {
    const all = await this.supplier.flours();
    const wanted = all.find((f) => f.sku === sku);
    if (!wanted) return null;
    const options = all.filter((f) => f.sku !== sku && f.grade === wanted.grade && f.bagsInStock >= bags);
    options.sort((a, b) => a.pricePerBag - b.pricePerBag);
    return options.length > 0 ? options[0].sku : null;
  }
}
