export interface PetView {
  readonly id: string;
  readonly name: string;
  readonly species: string;
  readonly status: string;
  readonly arrivedOn: string;
  readonly adoptedOn: string | null;
}

export interface Intake {
  admitPet(name: string, species: string): { id: string };
  registerAdopter(name: string): { id: string };
  pet(id: string): PetView;
}
