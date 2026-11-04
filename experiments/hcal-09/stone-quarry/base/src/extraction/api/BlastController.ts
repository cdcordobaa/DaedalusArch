import { BlastService } from '../application/BlastService';
import { BlastDto } from '../contracts/BlastDto';
import { PermitExceededError } from '../domain/bench/PermitExceededError';

export type PlanBlastResponse = { status: 201; body: BlastDto } | { status: 409; error: string };

export class BlastController {
  constructor(private readonly blasts: BlastService) {}

  async postBlast(body: { benchId: string; tonnes: number; month: string }): Promise<PlanBlastResponse> {
    try {
      return { status: 201, body: await this.blasts.planBlast(body.benchId, body.tonnes, body.month) };
    } catch (e) {
      if (e instanceof PermitExceededError) return { status: 409, error: e.message };
      throw e;
    }
  }
}
