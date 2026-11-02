import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  get(hireId: string): Promise<Hire | null>;
}
