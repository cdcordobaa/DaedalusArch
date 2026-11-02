import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  get(hireId: string): Promise<Hire | null>;
  /** Keeps a new hire only if its boat has no other hire on any of the same nights; answers whether it was kept. */
  saveIfBoatFree(hire: Hire): Promise<boolean>;
}
