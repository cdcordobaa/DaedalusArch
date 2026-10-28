import { Fulfilment } from '../domain/Fulfilment';
import { UnitRequest } from '../domain/UnitRequest';
import type { Fridge } from './needs/Fridge';
import type { RequestAnswer, RequestUnits, UnitRequestInput } from './RequestUnits';

export class RequestUnitsService implements RequestUnits {
  constructor(private readonly fridge: Fridge) {}

  async request(input: UnitRequestInput): Promise<RequestAnswer> {
    const request = UnitRequest.of(input);
    const fromStock = Math.min(request.units, this.fridge.onHand(request.component, request.group));
    if (fromStock > 0) this.fridge.take(request.component, request.group, fromStock);
    const fulfilment = Fulfilment.of(request.units, fromStock);
    return { fromStock: fulfilment.fromStock, outstanding: fulfilment.outstanding, status: fulfilment.status() };
  }
}
