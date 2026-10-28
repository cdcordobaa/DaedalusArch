import { Fulfilment } from '../domain/Fulfilment';
import { UnitRequest } from '../domain/UnitRequest';
import type { Fridge } from './needs/Fridge';
import type { Supplier } from './needs/Supplier';
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
    let held: { hold: 'shortage' | 'quarantine'; until: string } | null = null;
    if (missing > 0) {
      const key = `${request.component}|${request.group}`;
      const known = this.holds.get(key);
      if (known && known.untilMs > Date.now()) {
        held = known;
      } else {
        this.holds.delete(key);
        const answer = await this.supplier.order({
          component: request.component,
          group: request.group,
          units: missing,
          urgent: request.urgent,
        });
        if ('hold' in answer) {
          held = answer;
          this.holds.set(key, { hold: answer.hold, until: answer.until, untilMs: Date.parse(answer.until) });
        } else {
          fromSupplier = answer.confirmed;
          supplierOrder = answer.orderNumber;
        }
      }
    }
    if (fromStock > 0) this.fridge.take(request.component, request.group, fromStock);
    const fulfilment = Fulfilment.of(request.units, fromStock, fromSupplier);
    return {
      fromStock: fulfilment.fromStock,
      fromSupplier: fulfilment.fromSupplier,
      supplierOrder,
      outstanding: fulfilment.outstanding,
      status: fulfilment.status(held !== null),
      holdReason: held?.hold ?? null,
      holdUntil: held?.until ?? null,
    };
  }
}
