import type { Section, Singer } from './singer';

export interface SingerRepository {
  findById(id: string): Promise<Singer | undefined>;
  findBySection(section: Section): Promise<Singer[]>;
  save(singer: Singer): Promise<void>;
}
