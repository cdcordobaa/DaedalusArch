import { PropertyService } from '../application/PropertyService';

export interface AddUnitRequest {
  readonly propertyId: string;
  readonly unitId: string;
  readonly label: string;
}

export type AddUnitResult = { ok: true } | { ok: false; error: string };

export class PropertyController {
  constructor(private readonly service: PropertyService) {}

  addUnit(request: AddUnitRequest): AddUnitResult {
    try {
      this.service.addUnit(request.propertyId, request.unitId, request.label);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'failed' };
    }
  }
}
