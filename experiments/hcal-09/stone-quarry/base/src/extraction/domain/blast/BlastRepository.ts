import { Blast } from './Blast';

export interface BlastRepository {
  findById(id: string): Promise<Blast | null>;
  findByBenchAndMonth(benchId: string, month: string): Promise<Blast[]>;
  save(blast: Blast): Promise<void>;
}
