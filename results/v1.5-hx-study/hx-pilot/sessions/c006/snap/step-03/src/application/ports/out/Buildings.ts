import type { Building } from '../../../domain/Building';

export interface Buildings {
  nextId(): string;
  add(building: Building): void;
  byId(id: string): Building | undefined;
}
