import type { Kayak } from './kayak';

export interface KayakRepository {
  findById(id: string): Promise<Kayak | undefined>;
  findAll(): Promise<Kayak[]>;
  save(kayak: Kayak): Promise<void>;
}
