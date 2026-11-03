import { AssignBenchPort } from '../../../application/ports/in/assign-bench.port';
import { Bench } from '../../../domain/bench';

export class BenchController {
  constructor(private readonly benches: AssignBenchPort) {}

  async postAssign(params: { jobId: string; bench: Bench }): Promise<{ days: number }> {
    return { days: await this.benches.assign(params) };
  }
}
