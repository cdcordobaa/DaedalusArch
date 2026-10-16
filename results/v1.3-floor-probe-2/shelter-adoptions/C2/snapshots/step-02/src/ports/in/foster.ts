import { FosterCarer, Placement } from '../../domain/foster';

export interface SignUpCarerInput { name: string; email: string; phone?: string; capacity: number; species: string[] }

export interface FosterUseCases {
  signUp(input: SignUpCarerInput): FosterCarer;
  listCarers(): FosterCarer[];
  place(animalId: string, carerId: string): Placement;
  endPlacement(placementId: string): Placement;
}
