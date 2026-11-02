import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  /** Keeps the hire only if no other hire of the boat shares a night; answers false (and keeps nothing) otherwise. Check and save are one step. */
  saveIfBoatFree(hire: Hire): Promise<boolean>;
  get(hireId: string): Promise<Hire | null>;
}
