import { ShelterError } from '../errors/ShelterError';
import { requireDay } from './Calendar';

export const SPECIES = ['cat', 'dog', 'rabbit'] as const;
export type Species = (typeof SPECIES)[number];
export type PetStatus = 'available' | 'adopted';

/** An animal in the shelter's care, from its arrival until it is adopted. */
export class Pet {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly species: Species,
    readonly arrivedOn: string,
    private currentStatus: PetStatus,
    private adoptionDay: string | null,
  ) {}

  static admit(id: string, name: string, species: string, arrivedOn: string): Pet {
    const trimmed = name.trim();
    if (trimmed === '') throw new ShelterError('a pet needs a name');
    const kind = species.trim().toLowerCase();
    if (!(SPECIES as readonly string[]).includes(kind)) throw new ShelterError(`unknown species '${species}'`);
    return new Pet(id, trimmed, kind as Species, requireDay(arrivedOn), 'available', null);
  }

  get status(): PetStatus {
    return this.currentStatus;
  }

  get adoptedOn(): string | null {
    return this.adoptionDay;
  }

  isAvailable(): boolean {
    return this.currentStatus === 'available';
  }

  adopt(on: string): void {
    if (!this.isAvailable()) throw new ShelterError(`pet ${this.id} is adopted`);
    this.currentStatus = 'adopted';
    this.adoptionDay = requireDay(on);
  }
}
