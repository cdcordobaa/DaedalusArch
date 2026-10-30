import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  /** Saves the hire unless another hire of the same boat has any of the same nights; answers whether it was saved. */
  saveIfBoatFree(hire: Hire): Promise<boolean>;
  get(hireId: string): Promise<Hire | null>;
}
