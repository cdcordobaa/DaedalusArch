import { Bench } from './Bench';

export interface BenchRepository {
  findById(id: string): Promise<Bench | null>;
}
