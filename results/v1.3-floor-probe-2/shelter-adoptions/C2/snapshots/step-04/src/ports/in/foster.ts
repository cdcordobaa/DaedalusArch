import { FosterCarer, Placement } from '../../domain/foster';

export interface SignUpCarerInput { name: string; email: string; phone?: string; notifyBy?: 'email' | 'sms'; capacity: number; species: string[] }

export interface FosterUseCases {
  signUp(input: SignUpCarerInput): FosterCarer;
  listCarers(): FosterCarer[];
  place(animalId: string, carerId: string, actor: string): Placement;
  endPlacement(placementId: string, actor: string): Placement;
}
