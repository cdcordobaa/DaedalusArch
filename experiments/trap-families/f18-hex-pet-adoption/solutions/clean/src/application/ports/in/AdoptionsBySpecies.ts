export interface SpeciesAdoptions {
  readonly species: string;
  readonly adopted: number;
  readonly averageStayDays: number;
}

export interface AdoptionsBySpecies {
  /** Pets adopted in the month (YYYY-MM) per species, most first; ties in species order. */
  adoptionsBySpecies(month: string): SpeciesAdoptions[];
}
