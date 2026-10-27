import { PropertyRepository } from '../domain/property/PropertyRepository';
import { PropertyService } from '../application/PropertyService';

export interface AddUnitRequest {
  readonly propertyId: string;
  readonly unitId: string;
  readonly label: string;
}

export type AddUnitResult = { ok: true } | { ok: false; error: string };

export class PropertyController {
  constructor(
    private readonly service: PropertyService,
    private readonly repo: PropertyRepository,
  ) {}

  addUnit(request: AddUnitRequest): AddUnitResult {
    const property = this.repo.findById(request.propertyId);
    if (!property) return { ok: false, error: 'property not found' };
    if (property.unitsView().some((u) => u.id === request.unitId)) {
      return { ok: false, error: 'duplicate unit' };
    }
    this.service.addUnit(request.propertyId, request.unitId, request.label);
    return { ok: true };
  }
}
