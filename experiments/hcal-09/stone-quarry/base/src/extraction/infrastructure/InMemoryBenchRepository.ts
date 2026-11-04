import { Bench } from '../domain/bench/Bench';
import { BenchRepository } from '../domain/bench/BenchRepository';

export class InMemoryBenchRepository implements BenchRepository {
  private readonly rows = new Map<string, Bench>();

  constructor(seed: readonly Bench[] = []) {
    for (const bench of seed) this.rows.set(bench.id, bench);
  }

  async findById(id: string): Promise<Bench | null> {
    return this.rows.get(id) ?? null;
  }
}
