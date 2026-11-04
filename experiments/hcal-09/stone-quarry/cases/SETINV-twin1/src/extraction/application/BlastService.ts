import { newId } from '../../shared-kernel/ids';
import { BlastDto } from '../contracts/BlastDto';
import { BenchRepository } from '../domain/bench/BenchRepository';
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
    const blast = bench.authoriseBlast(blastsThisMonth, newId('BL'), plannedTonnes, month);
    await this.blasts.save(blast);
    return toDto(blast);
  }

  async replanBlast(blastId: string, newTonnes: number): Promise<BlastDto> {
    const blast = await this.blasts.findById(blastId);
    if (blast === null) throw new Error(`blast ${blastId} not found`);
    const bench = await this.benches.findById(blast.benchId);
    if (bench === null) throw new Error(`bench ${blast.benchId} not found`);
    bench.authoriseReplan(await this.blasts.findByBenchAndMonth(blast.benchId, blast.month), blast, newTonnes);
    blast.replan(newTonnes);
    await this.blasts.save(blast);
    return toDto(blast);
  }
}
