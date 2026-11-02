import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  get(hireId: string): Promise<Hire | null>;
  /** Saves the hire only if no other hire satisfies `clashes`; the check and the save are one step. Returns false when nothing was kept. */
  saveIfNoClash(hire: Hire, clashes: (other: Hire) => boolean): Promise<boolean>;
}
