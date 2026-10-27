import type { InMemoryPetStore } from '../../adapters/out/memory/InMemoryPetStore';
import { daysBetween, requireMonth } from '../../domain/model/Calendar';

export class AdoptionStatsService {
  constructor(private readonly pets: InMemoryPetStore) {}

  bySpecies(month: string) {
    requireMonth(month);
    const stays = new Map<string, number[]>();
    for (const pet of this.pets.all()) {
      if (!pet.adoptedOn?.startsWith(`${month}-`)) continue;
      stays.set(pet.species, [...(stays.get(pet.species) ?? []), daysBetween(pet.arrivedOn, pet.adoptedOn)]);
    }
    return [...stays].map(([species, d]) => ({ species, adopted: d.length, averageStayDays: Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 }))
      .sort((a, b) => b.adopted - a.adopted || (a.species < b.species ? -1 : 1));
  }
}
