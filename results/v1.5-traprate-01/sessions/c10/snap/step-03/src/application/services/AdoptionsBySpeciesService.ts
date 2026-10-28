import { daysBetween, requireMonth } from '../../domain/model/Calendar';
import type { AdoptionsBySpecies, SpeciesAdoptions } from '../ports/in/AdoptionsBySpecies';
import type { PetStore } from '../ports/out/PetStore';

export class AdoptionsBySpeciesService implements AdoptionsBySpecies {
  constructor(private readonly pets: PetStore) {}

  adoptionsBySpecies(month: string): SpeciesAdoptions[] {
    requireMonth(month);
    const stays = new Map<string, number[]>();
    for (const p of this.pets.adopted()) {
      if (p.adoptedOn === null || !p.adoptedOn.startsWith(`${month}-`)) continue;
      const list = stays.get(p.species) ?? [];
      list.push(daysBetween(p.arrivedOn, p.adoptedOn));
      stays.set(p.species, list);
    }
    return [...stays.entries()]
      .map(([species, days]) => ({
        species,
        adopted: days.length,
        averageStayDays: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
      }))
      .sort((a, b) => b.adopted - a.adopted || (a.species < b.species ? -1 : 1));
  }
}
