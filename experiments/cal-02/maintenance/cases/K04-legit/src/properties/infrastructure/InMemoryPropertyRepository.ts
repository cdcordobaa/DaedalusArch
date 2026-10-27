import { UnitSnapshot } from '../contracts/PropertyContracts';
import { Property } from '../domain/property/Property';
import { PropertyRepository } from '../domain/property/PropertyRepository';

export class InMemoryPropertyRepository implements PropertyRepository {
  private readonly items = new Map<string, Property>();

  save(property: Property): void {
    this.items.set(property.id, property);
  }

  findById(id: string): Property | undefined {
    return this.items.get(id);
  }

  private readonly unitIndex = new Map<string, UnitSnapshot>();

  saveWithUnits(property: Property): void {
    this.items.set(property.id, property);
    for (const unit of property.unitsView()) this.unitIndex.set(property.id + ':' + unit.id, unit);
  }
}
