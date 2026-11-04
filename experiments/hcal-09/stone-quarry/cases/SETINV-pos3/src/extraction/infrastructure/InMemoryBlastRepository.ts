import { PermitExceededError } from '../domain/bench/PermitExceededError';
import { BenchRepository } from '../domain/bench/BenchRepository';
import { Blast } from '../domain/blast/Blast';
import { BlastRepository } from '../domain/blast/BlastRepository';

export class InMemoryBlastRepository implements BlastRepository {
  private readonly rows = new Map<string, Blast>();

  constructor(private readonly benches: BenchRepository) {}

  async findById(id: string): Promise<Blast | null> {
    return this.rows.get(id) ?? null;
  }

  async findByBenchAndMonth(benchId: string, month: string): Promise<Blast[]> {
    return [...this.rows.values()].filter((b) => b.benchId === benchId && b.month === month);
  }

  async save(blast: Blast): Promise<void> {
    const bench = await this.benches.findById(blast.benchId);
    if (bench !== null) {
      const others = (await this.findByBenchAndMonth(blast.benchId, blast.month)).filter((b) => b.id !== blast.id);
      const planned = others.reduce((sum, b) => sum + b.plannedTonnes, 0) + blast.plannedTonnes;
      if (planned > bench.permittedTonnesPerMonth) throw new PermitExceededError(bench.id, blast.month);
    }
    this.rows.set(blast.id, blast);
  }
}
