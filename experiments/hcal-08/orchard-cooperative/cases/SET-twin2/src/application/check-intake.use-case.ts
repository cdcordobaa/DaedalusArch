import { acceptsForPressing } from '../domain/intake-check';
import { CheckIntakeCommand, CheckIntakePort } from './ports/in/check-intake.port';

export class CheckIntakeUseCase implements CheckIntakePort {
  async check(command: CheckIntakeCommand): Promise<boolean> {
    return acceptsForPressing(command.check);
  }
}
