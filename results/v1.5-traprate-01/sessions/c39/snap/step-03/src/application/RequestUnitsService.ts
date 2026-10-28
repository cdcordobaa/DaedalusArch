import type { BloodGroup } from '../domain/BloodGroup';
import type { Component } from '../domain/Component';
import { Fulfilment } from '../domain/Fulfilment';
import { UnitRequest } from '../domain/UnitRequest';
import type { Fridge } from './needs/Fridge';
import type { Supplier, SupplyConfirmation, SupplyHold } from './needs/Supplier';
import type { RequestAnswer, RequestUnits, UnitRequestInput } from './RequestUnits';

export class RequestUnitsService implements RequestUnits {
  constructor(
    private readonly fridge: Fridge,
    private readonly supplier: Supplier,
  ) {}

  private readonly holds = new Map<string, { hold: 'shortage' | 'quarantine'; until: string; untilMs: number }>();

  async request(input: UnitRequestInput): Promise<RequestAnswer> {
    const request = UnitRequest.of(input);
    const fromStock = Math.min(request.units, this.fridge.onHand(request.component, request.group));
    const missing = request.units - fromStock;
    let fromSupplier = 0;
    let supplierOrder: string | null = null;
    // Ordered before the fridge is touched, so a failing supplier takes none of our stock.
    let held: SupplyHold | null = null;
    if (missing > 0) {
      const answer = await this.orderUnlessHeld(request.component, request.group, missing, request.urgent);
      if ('hold' in answer) {
        held = answer;
      } else {
        fromSupplier = answer.confirmed;
        supplierOrder = answer.orderNumber;
      }
    }
    let coverStock = 0;
    let coverSupplier = 0;
    let coverOrder: string | null = null;
    const stillMissing = missing - fromSupplier;
    if (stillMissing > 0 && request.urgent && request.component === 'red cells' && request.group !== 'O-') {
      coverStock = Math.min(stillMissing, this.fridge.onHand('red cells', 'O-'));
      const rest = stillMissing - coverStock;
      if (rest > 0) {
        // An O negative embargo is not ours to report: the units simply stay outstanding.
        const answer = await this.orderUnlessHeld('red cells', 'O-', rest, true);
        if (!('hold' in answer)) {
          coverSupplier = answer.confirmed;
          coverOrder = answer.orderNumber;
        }
      }
    }
    if (fromStock > 0) this.fridge.take(request.component, request.group, fromStock);
    if (coverStock > 0) this.fridge.take('red cells', 'O-', coverStock);
    const fulfilment = Fulfilment.of(request.units, fromStock, fromSupplier, coverStock + coverSupplier);
    return {
      fromStock: fulfilment.fromStock,
      fromSupplier: fulfilment.fromSupplier,
      supplierOrder,
      substituted: fulfilment.substituted,
      coverOrder,
      outstanding: fulfilment.outstanding,
      status: fulfilment.status(held !== null),
      holdReason: held?.hold ?? null,
      holdUntil: held?.until ?? null,
    };
  }

  /** Orders from the supplier unless the group is known to be on hold, in which case the hold is returned. */
  private async orderUnlessHeld(
    component: Component,
    group: BloodGroup,
    units: number,
    urgent: boolean,
  ): Promise<SupplyConfirmation | SupplyHold> {
    const key = `${component}|${group}`;
    const known = this.holds.get(key);
    if (known && known.untilMs > Date.now()) return known;
    this.holds.delete(key);
    const answer = await this.supplier.order({ component, group, units, urgent });
    if ('hold' in answer) {
      this.holds.set(key, { hold: answer.hold, until: answer.until, untilMs: Date.parse(answer.until) });
    }
    return answer;
  }
}
