export interface SpeciesAdoptions {
  readonly species: string;
  readonly adopted: number;
  readonly averageStayDays: number;
}

export interface AdoptionsBySpecies {
  /** Adoptions of a month (YYYY-MM) per species, most adoptions first; equal counts in species name order. */
  adoptionsBySpecies(month: string): SpeciesAdoptions[];
}
