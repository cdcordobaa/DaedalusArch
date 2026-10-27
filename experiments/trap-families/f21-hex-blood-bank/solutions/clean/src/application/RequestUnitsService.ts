import type { BloodGroup } from '../domain/BloodGroup';
import type { Component } from '../domain/Component';
import { takesONegativeCover, UNIVERSAL_RED_CELLS } from '../domain/Cover';
import { Fulfilment } from '../domain/Fulfilment';
import { SupplyHeld, type SupplyHold } from '../domain/supply/SupplyHold';
import { SupplyHolds } from '../domain/supply/SupplyHolds';
import type { SupplyOrder } from '../domain/supply/SupplyOrder';
import { UnitRequest } from '../domain/UnitRequest';
import type { Fridge } from './needs/Fridge';
import type { Supplier } from './needs/Supplier';
import type { RequestAnswer, RequestUnits, UnitRequestInput } from './RequestUnits';

type Sourced = { units: number; orderNumber: string | null; hold: SupplyHold | null };

export class RequestUnitsService implements RequestUnits {
  constructor(
    private readonly fridge: Fridge,
    private readonly supplier: Supplier,
    private readonly holds: SupplyHolds = new SupplyHolds(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async request(input: UnitRequestInput): Promise<RequestAnswer> {
    const request = UnitRequest.of(input);
    const takes: { component: Component; group: BloodGroup; units: number }[] = [];

    const fromStock = Math.min(request.units, this.fridge.onHand(request.component, request.group));
    takes.push({ component: request.component, group: request.group, units: fromStock });
    const own = await this.source({ component: request.component, group: request.group, units: request.units - fromStock, urgent: request.urgent });

    let substituted = 0;
    let cover: Sourced = { units: 0, orderNumber: null, hold: null };
    const missing = request.units - fromStock - own.units;
    if (missing > 0 && takesONegativeCover(request)) {
      const fromONegStock = Math.min(missing, this.fridge.onHand('red cells', UNIVERSAL_RED_CELLS));
      takes.push({ component: 'red cells', group: UNIVERSAL_RED_CELLS, units: fromONegStock });
      cover = await this.source({ component: 'red cells', group: UNIVERSAL_RED_CELLS, units: missing - fromONegStock, urgent: true });
      substituted = fromONegStock + cover.units;
    }

    for (const t of takes) if (t.units > 0) this.fridge.take(t.component, t.group, t.units);
    const fulfilment = Fulfilment.of(request.units, { fromStock, fromSupplier: own.units, substituted, ownGroupHeld: own.hold !== null });
    return {
      fromStock: fulfilment.fromStock,
      fromSupplier: fulfilment.fromSupplier,
      substituted: fulfilment.substituted,
      outstanding: fulfilment.outstanding,
      status: fulfilment.status(),
      supplierOrder: own.orderNumber,
      coverOrder: cover.orderNumber,
      holdReason: own.hold?.reason ?? null,
      holdUntil: own.hold?.until.toISOString() ?? null,
    };
  }

  /** Orders the units from the supplier unless none are needed or the component and group are on hold. */
  private async source(order: SupplyOrder): Promise<Sourced> {
    if (order.units <= 0) return { units: 0, orderNumber: null, hold: null };
    const known = this.holds.activeFor(order.component, order.group, this.now());
    if (known !== null) return { units: 0, orderNumber: null, hold: known };
    try {
      const confirmation = await this.supplier.order(order);
      return { units: Math.min(order.units, confirmation.confirmed), orderNumber: confirmation.orderNumber, hold: null };
    } catch (e) {
      if (!(e instanceof SupplyHeld)) throw e;
      this.holds.place(order.component, order.group, e.hold);
      return { units: 0, orderNumber: null, hold: e.hold };
    }
  }
}
