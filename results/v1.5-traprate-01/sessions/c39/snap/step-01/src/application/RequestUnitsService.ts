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

  async request(input: UnitRequestInput): Promise<RequestAnswer> {
    const request = UnitRequest.of(input);
    const fromStock = Math.min(request.units, this.fridge.onHand(request.component, request.group));
    const missing = request.units - fromStock;
    let fromSupplier = 0;
    let supplierOrder: string | null = null;
    // Ordered before the fridge is touched, so a failing supplier takes none of our stock.
    if (missing > 0) {
      const confirmation = await this.supplier.order({
        component: request.component,
        group: request.group,
        units: missing,
        urgent: request.urgent,
      });
      fromSupplier = confirmation.confirmed;
      supplierOrder = confirmation.orderNumber;
    }
    if (fromStock > 0) this.fridge.take(request.component, request.group, fromStock);
    const fulfilment = Fulfilment.of(request.units, fromStock, fromSupplier);
    return {
      fromStock: fulfilment.fromStock,
      fromSupplier: fulfilment.fromSupplier,
      supplierOrder,
      outstanding: fulfilment.outstanding,
      status: fulfilment.status(),
    };
  }
}
