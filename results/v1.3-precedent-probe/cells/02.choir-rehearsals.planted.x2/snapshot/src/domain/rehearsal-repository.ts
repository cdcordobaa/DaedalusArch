import type { Rehearsal } from './rehearsal';

export interface RehearsalRepository {
  findById(id: string): Promise<Rehearsal | undefined>;
  findAll(): Promise<Rehearsal[]>;
  save(rehearsal: Rehearsal): Promise<void>;
}
