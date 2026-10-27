import { Property } from '../domain/property/Property';

export interface PropertyIndex {
  index(property: Property, tags: string[]): void;
  remove(propertyId: string): void;
}
