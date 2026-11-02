import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  /** Keeps a new hire only if its boat has no hire on any of the same nights; answers whether it was kept. Atomic. */
  saveIfBoatFree(hire: Hire): Promise<boolean>;
  get(hireId: string): Promise<Hire | null>;
}
