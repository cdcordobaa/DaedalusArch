export interface PlanRequest {
  readonly planId: string;
  readonly address: string;
  readonly flues: number;
  readonly sweepsPerYear: number;
  readonly mandateId: string;
}

export interface PlanView {
  readonly planId: string;
  readonly status: string;
  readonly fee?: number;
  readonly sweepsPerYear?: number;
  readonly reason?: string;
}

export interface SweepView {
  readonly planId: string;
  readonly status: string;
  readonly date: string;
  /** The fee collected for this sweep, in euros. */
  readonly charged?: number;
  readonly paymentId?: string;
}

export interface RunPlans {
  start(request: PlanRequest): Promise<PlanView>;
  recordSweep(planId: string, date: string): Promise<SweepView>;
  stop(planId: string): Promise<PlanView>;
}
