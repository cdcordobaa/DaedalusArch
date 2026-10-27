import type { PetStore } from '../../../application/ports/out/PetStore';
import type { Pet } from '../../../domain/model/Pet';

export class InMemoryPetStore implements PetStore {
  private readonly rows = new Map<string, Pet>();

  nextId(): string {
    return `P-${String(this.rows.size + 1).padStart(4, '0')}`;
  }

  save(pet: Pet): void {
    this.rows.set(pet.id, pet);
  }

  byId(id: string): Pet | undefined {
    return this.rows.get(id);
  }

  available(): Pet[] {
    return this.all().filter((p) => p.isAvailable());
  }

  adoptedIn(month: string): Pet[] {
    return this.all().filter((p) => p.adoptedOn?.startsWith(`${month}-`) === true);
  }

  /** Every stored pet, in id order. */
  all(): Pet[] {
    return [...this.rows.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }
}
