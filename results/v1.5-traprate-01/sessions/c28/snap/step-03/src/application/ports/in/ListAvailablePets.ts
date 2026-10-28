export interface AvailablePet {
  readonly id: string;
  readonly name: string;
  readonly species: string;
  readonly daysInShelter: number;
}

export interface ListAvailablePets {
  /** Pets still waiting for a home, longest in the shelter first; equal stays in id order. */
  availablePets(): AvailablePet[];
}
