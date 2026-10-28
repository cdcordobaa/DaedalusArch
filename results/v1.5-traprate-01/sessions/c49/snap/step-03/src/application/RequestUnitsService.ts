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
    let substituted = 0;
    let coverStock = 0;
    let coverOrder: string | null = null;
    const remaining = missing - fromSupplier;
    if (remaining > 0 && request.urgent && request.component === 'red cells' && request.group !== 'O-') {
      coverStock = Math.min(remaining, this.fridge.onHand('red cells', 'O-'));
      const stillMissing = remaining - coverStock;
      let coverSupplier = 0;
      if (stillMissing > 0) {
        const coverKey = 'red cells|O-';
        const active = this.holds.get(coverKey);
        let coverHold: SupplierHold | null = null;
        if (active && Date.now() < Date.parse(active.until)) coverHold = active;
        else this.holds.delete(coverKey);
        if (!coverHold) {
          // A failure here throws before any of our stock is taken.
          const confirmation = await this.supplier.order({
            component: 'red cells',
            group: 'O-',
            units: stillMissing,
            urgent: true,
          });
          coverSupplier = confirmation.units;
          if (confirmation.hold) {
            if (!Number.isNaN(Date.parse(confirmation.hold.until))) this.holds.set(coverKey, confirmation.hold);
          } else {
            coverOrder = confirmation.orderNumber;
          }
        }
      }
      substituted = coverStock + coverSupplier;
    }
    if (coverStock > 0) this.fridge.take('red cells', 'O-', coverStock);
    if (fromStock > 0) this.fridge.take(request.component, request.group, fromStock);
    const fulfilment = Fulfilment.of(request.units, fromStock, fromSupplier, substituted);
    return {
      fromStock: fulfilment.fromStock,
      fromSupplier: fulfilment.fromSupplier,
      supplierOrder,
      substituted,
      coverOrder,
      outstanding: fulfilment.outstanding,
      status: fulfilment.outstanding === 0 ? 'filled' : hold ? 'on hold' : fulfilment.status(),
      holdReason: hold ? hold.reason : null,
      holdUntil: hold ? hold.until : null,
    };
  }
}
