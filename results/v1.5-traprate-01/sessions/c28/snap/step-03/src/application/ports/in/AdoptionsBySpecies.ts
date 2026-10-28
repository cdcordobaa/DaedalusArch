import type { Species } from '../../../domain/model/Pet';

export interface SpeciesAdoptions {
  readonly species: Species;
  readonly adopted: number;
  readonly averageStayDays: number;
}

export interface AdoptionsBySpecies {
  /** Adoptions in a month (YYYY-MM) per species; most adopted first, equal counts by species name. */
  adoptionsBySpecies(month: string): SpeciesAdoptions[];
}
