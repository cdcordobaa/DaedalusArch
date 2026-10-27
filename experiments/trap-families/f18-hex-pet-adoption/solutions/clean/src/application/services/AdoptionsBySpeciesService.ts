import { daysBetween, requireMonth } from '../../domain/model/Calendar';
import type { AdoptionsBySpecies, SpeciesAdoptions } from '../ports/in/AdoptionsBySpecies';
import type { PetStore } from '../ports/out/PetStore';

export class AdoptionsBySpeciesService implements AdoptionsBySpecies {
  constructor(private readonly pets: PetStore) {}

  adoptionsBySpecies(month: string): SpeciesAdoptions[] {
    const stays = new Map<string, number[]>();
    for (const pet of this.pets.adoptedIn(requireMonth(month))) {
      const list = stays.get(pet.species) ?? [];
      list.push(daysBetween(pet.arrivedOn, pet.adoptedOn ?? pet.arrivedOn));
      stays.set(pet.species, list);
    }
    return [...stays.entries()]
      .map(([species, days]) => ({ species, adopted: days.length, averageStayDays: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 }))
      .sort((a, b) => b.adopted - a.adopted || (a.species < b.species ? -1 : 1));
  }
}
