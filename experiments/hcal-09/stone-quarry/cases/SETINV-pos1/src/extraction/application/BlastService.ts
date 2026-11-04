import { newId } from '../../shared-kernel/ids';
import { BlastDto } from '../contracts/BlastDto';
import { BenchRepository } from '../domain/bench/BenchRepository';
import { PermitExceededError } from '../domain/bench/PermitExceededError';
import { Blast } from '../domain/blast/Blast';
import { BlastRepository } from '../domain/blast/BlastRepository';

const toDto = (blast: Blast): BlastDto => ({ id: blast.id, benchId: blast.benchId, plannedTonnes: blast.plannedTonnes, month: blast.month });

export class BlastService {
  constructor(
    private readonly benches: BenchRepository,
    private readonly blasts: BlastRepository,
  ) {}

  async planBlast(benchId: string, plannedTonnes: number, month: string): Promise<BlastDto> {
    const bench = await this.benches.findById(benchId);
    if (bench === null) throw new Error(`bench ${benchId} not found`);
    const blastsThisMonth = await this.blasts.findByBenchAndMonth(benchId, month);
    const planned = blastsThisMonth.reduce((sum, b) => sum + b.plannedTonnes, 0);
    if (planned + plannedTonnes > bench.permittedTonnesPerMonth) throw new PermitExceededError(bench.id, month);
    const blast = Blast.plan(newId('BL'), bench.id, plannedTonnes, month);
    await this.blasts.save(blast);
    return toDto(blast);
  }
}
