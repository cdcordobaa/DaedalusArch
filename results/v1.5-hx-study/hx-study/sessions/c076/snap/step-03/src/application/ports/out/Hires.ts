import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  /** Saves the hire unless the boat already has another hire on any of its nights; returns false if so. */
  saveIfBoatFree(hire: Hire): Promise<boolean>;
  get(hireId: string): Promise<Hire | null>;
}
