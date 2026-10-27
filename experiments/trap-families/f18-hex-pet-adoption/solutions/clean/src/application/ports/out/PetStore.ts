import type { Pet } from '../../../domain/model/Pet';

export interface PetStore {
  nextId(): string;
  save(pet: Pet): void;
  byId(id: string): Pet | undefined;
  /** Pets not yet adopted, in id order. */
  available(): Pet[];
  /** Pets adopted in a month (YYYY-MM), in id order. */
  adoptedIn(month: string): Pet[];
}
