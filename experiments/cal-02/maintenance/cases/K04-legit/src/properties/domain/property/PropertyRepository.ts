import { Property } from './Property';

export interface PropertyRepository {
  save(property: Property): void;
  findById(id: string): Property | undefined;

  saveWithUnits(property: Property): void;
}
