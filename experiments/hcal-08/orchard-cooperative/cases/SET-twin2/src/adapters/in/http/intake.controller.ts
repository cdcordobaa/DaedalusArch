import { CheckIntakePort } from '../../../application/ports/in/check-intake.port';
import { IntakeCheck } from '../../../domain/intake-check';

export class IntakeController {
  constructor(private readonly intake: CheckIntakePort) {}

  async postCheck(params: { lotId: string; check: IntakeCheck }): Promise<{ accepted: boolean }> {
    return { accepted: await this.intake.check(params) };
  }
}
