import { Blast } from '../domain/blast/Blast';
import { BlastRepository } from '../domain/blast/BlastRepository';

export class InMemoryBlastRepository implements BlastRepository {
  private readonly rows = new Map<string, Blast>();

  async findById(id: string): Promise<Blast | null> {
    return this.rows.get(id) ?? null;
  }

  async findByBenchAndMonth(benchId: string, month: string): Promise<Blast[]> {
    return [...this.rows.values()].filter((b) => b.benchId === benchId && b.month === month);
  }

  async save(blast: Blast): Promise<void> {
    this.rows.set(blast.id, blast);
  }
}
