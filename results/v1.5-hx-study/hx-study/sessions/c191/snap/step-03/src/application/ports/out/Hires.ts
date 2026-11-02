import type { Hire } from '../../../domain/model/Hire';

export interface Hires {
  save(hire: Hire): Promise<void>;
  forBoat(boatId: string): Promise<Hire[]>;
  get(hireId: string): Promise<Hire | null>;
}
