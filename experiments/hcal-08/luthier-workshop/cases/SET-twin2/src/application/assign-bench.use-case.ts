import { benchDays } from '../domain/bench';
import { AssignBenchCommand, AssignBenchPort } from './ports/in/assign-bench.port';

export class AssignBenchUseCase implements AssignBenchPort {
  async assign(command: AssignBenchCommand): Promise<number> {
    return benchDays(command.bench);
  }
}
