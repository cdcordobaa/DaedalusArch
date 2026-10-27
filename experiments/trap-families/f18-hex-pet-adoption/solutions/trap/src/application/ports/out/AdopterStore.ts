import type { Adopter } from '../../../domain/model/Adopter';

export interface AdopterStore {
  nextId(): string;
  save(adopter: Adopter): void;
  byId(id: string): Adopter | undefined;
}
