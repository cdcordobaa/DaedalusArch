import { daysBetween } from '../../domain/model/Calendar';
import type { AvailablePet, ListAvailablePets } from '../ports/in/ListAvailablePets';
import type { Clock } from '../ports/out/Clock';
import type { PetStore } from '../ports/out/PetStore';

export class ListAvailablePetsService implements ListAvailablePets {
  constructor(
    private readonly pets: PetStore,
    private readonly clock: Clock,
  ) {}

  availablePets(): AvailablePet[] {
    const today = this.clock.today();
    return this.pets
      .available()
      .map((p) => ({ id: p.id, name: p.name, species: p.species, daysInShelter: daysBetween(p.arrivedOn, today) }))
      .sort((a, b) => b.daysInShelter - a.daysInShelter || (a.id < b.id ? -1 : 1));
  }
}
