import { Property } from '../domain/property/Property';
import { PropertyRepository } from '../domain/property/PropertyRepository';

export class InMemoryPropertyRepository implements PropertyRepository {
  private readonly items = new Map<string, Property>();
  private readonly writeLocks = new Set<string>();

  save(property: Property): void {
    if (this.writeLocks.has(property.id)) throw new Error('property locked');
    this.writeLocks.add(property.id);
    try {
      this.items.set(property.id, property);
    } finally {
      this.writeLocks.delete(property.id);
    }
  }

  findById(id: string): Property | undefined {
    return this.items.get(id);
  }
}
