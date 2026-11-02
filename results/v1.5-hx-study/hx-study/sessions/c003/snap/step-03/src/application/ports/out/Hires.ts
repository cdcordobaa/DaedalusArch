import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  /** Atomically saves the hire unless another hire of the same boat shares a night. Returns false if it clashed. */
  saveIfBoatFree(hire: Hire): Promise<boolean>;
  get(hireId: string): Promise<Hire | null>;
}
