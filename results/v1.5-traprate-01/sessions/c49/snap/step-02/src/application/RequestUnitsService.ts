import { Fulfilment } from '../domain/Fulfilment';
import { UnitRequest } from '../domain/UnitRequest';
import type { Fridge } from './needs/Fridge';
import type { Supplier, SupplierHold } from './needs/Supplier';
import type { RequestAnswer, RequestUnits, UnitRequestInput } from './RequestUnits';

export class RequestUnitsService implements RequestUnits {
  constructor(
    private readonly fridge: Fridge,
    private readonly supplier: Supplier,
  ) {}

  private readonly holds = new Map<string, SupplierHold>();

  async request(input: UnitRequestInput): Promise<RequestAnswer> {
    const request = UnitRequest.of(input);
    const fromStock = Math.min(request.units, this.fridge.onHand(request.component, request.group));
    const missing = request.units - fromStock;
    let fromSupplier = 0;
    let supplierOrder: string | null = null;
    let hold: SupplierHold | null = null;
    const key = `${request.component}|${request.group}`;
    if (missing > 0) {
      const active = this.holds.get(key);
      if (active && Date.now() < Date.parse(active.until)) hold = active;
      else this.holds.delete(key);
    }
    if (missing > 0 && !hold) {
      // Ordered before anything is taken, so a failing supplier leaves our stock untouched.
      const confirmation = await this.supplier.order({
        component: request.component,
        group: request.group,
        units: missing,
        urgent: request.urgent,
      });
      fromSupplier = confirmation.units;
      if (confirmation.hold) {
        hold = confirmation.hold;
        if (!Number.isNaN(Date.parse(hold.until))) this.holds.set(key, hold);
      } else {
        supplierOrder = confirmation.orderNumber;
      }
    }
    if (fromStock > 0) this.fridge.take(request.component, request.group, fromStock);
    const fulfilment = Fulfilment.of(request.units, fromStock, fromSupplier);
    return {
      fromStock: fulfilment.fromStock,
      fromSupplier: fulfilment.fromSupplier,
      supplierOrder,
      outstanding: fulfilment.outstanding,
      status: fulfilment.outstanding === 0 ? 'filled' : hold ? 'on hold' : fulfilment.status(),
      holdReason: hold ? hold.reason : null,
      holdUntil: hold ? hold.until : null,
    };
  }
}
