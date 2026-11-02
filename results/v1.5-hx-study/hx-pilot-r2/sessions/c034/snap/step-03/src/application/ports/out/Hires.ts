import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  get(hireId: string): Promise<Hire | null>;
  /** Keeps the hire only if no other hire of the same boat shares a night with it; answers whether it was kept. Atomic. */
  saveIfBoatFree(hire: Hire): Promise<boolean>;
}
