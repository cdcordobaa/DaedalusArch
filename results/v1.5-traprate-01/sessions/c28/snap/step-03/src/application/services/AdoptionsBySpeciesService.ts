import { ShelterError } from '../../domain/errors/ShelterError';
import { daysBetween } from '../../domain/model/Calendar';
import type { AdoptionsBySpecies, SpeciesAdoptions } from '../ports/in/AdoptionsBySpecies';
import type { PetStore } from '../ports/out/PetStore';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export class AdoptionsBySpeciesService implements AdoptionsBySpecies {
  constructor(private readonly pets: PetStore) {}

  adoptionsBySpecies(month: string): SpeciesAdoptions[] {
    if (!MONTH.test(month)) throw new ShelterError(`not a month: ${month}`);
    const groups = new Map<SpeciesAdoptions['species'], number[]>();
    for (const p of this.pets.all()) {
      if (p.adoptedOn === null || !p.adoptedOn.startsWith(`${month}-`)) continue;
      const stays = groups.get(p.species) ?? [];
      stays.push(daysBetween(p.arrivedOn, p.adoptedOn));
      groups.set(p.species, stays);
    }
    return [...groups.entries()]
      .map(([species, stays]) => ({
        species,
        adopted: stays.length,
        averageStayDays: Math.round((stays.reduce((a, b) => a + b, 0) / stays.length) * 10) / 10,
      }))
      .sort((a, b) => b.adopted - a.adopted || (a.species < b.species ? -1 : 1));
  }
}
