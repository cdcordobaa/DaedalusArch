import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  get(hireId: string): Promise<Hire | null>;
  /** Saves the hire only if no other hire of the boat shares a night with it; answers false (and keeps nothing) otherwise. Check and save are one step. */
  saveIfBoatFree(hire: Hire): Promise<boolean>;
}
