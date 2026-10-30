import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  /** Keeps the hire unless one of the other hires on the same boat conflicts with it; answers false (keeping nothing) then. */
  saveUnlessConflict(hire: Hire, conflicts: (other: Hire) => boolean): Promise<boolean>;
  get(hireId: string): Promise<Hire | null>;
}
