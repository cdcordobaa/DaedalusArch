import type { RunPlans } from '../../../application/ports/in/RunPlans';
import type { PlanLetter } from '../../../application/ports/in/PlanLetter';
import type { ChargeStatus } from '../../../application/ports/in/ChargeStatus';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST /plans, POST /plans/:id/sweeps, POST /plans/:id/stop, GET /letters/:mandateId, GET /charges/:paymentId. */
export class PlansController {
  constructor(
    private readonly plans: RunPlans,
    private readonly letters: PlanLetter,
    private readonly charges: ChargeStatus,
  ) {}

  postPlan(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.plans.start({ planId: String(body.planId ?? ''), address: String(body.address ?? ''), flues: Number(body.flues), sweepsPerYear: Number(body.sweepsPerYear), mandateId: String(body.mandateId ?? '') }));
  }

  postSweep(planId: string, body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.plans.recordSweep(planId, String(body.date ?? '')));
  }

  postStop(planId: string): Promise<HttpResponse> {
    return this.run(() => this.plans.stop(planId));
  }

  getLetter(mandateId: string): Promise<HttpResponse> {
    return this.run(() => this.letters.letter(mandateId));
  }

  getCharge(paymentId: string): Promise<HttpResponse> {
    return this.run(() => this.charges.status(paymentId));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
