import { IntakeCheck } from '../../../domain/intake-check';

export interface CheckIntakeCommand {
  readonly lotId: string;
  readonly check: IntakeCheck;
}

export interface CheckIntakePort {
  check(command: CheckIntakeCommand): Promise<boolean>;
}
