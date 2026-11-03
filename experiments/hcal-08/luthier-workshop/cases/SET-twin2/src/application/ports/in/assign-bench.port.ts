import { Bench } from '../../../domain/bench';

export interface AssignBenchCommand {
  readonly jobId: string;
  readonly bench: Bench;
}

export interface AssignBenchPort {
  assign(command: AssignBenchCommand): Promise<number>;
}
