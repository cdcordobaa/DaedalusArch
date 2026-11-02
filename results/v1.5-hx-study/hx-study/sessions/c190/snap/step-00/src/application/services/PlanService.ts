import type { SweepPlan } from '../../domain/model/SweepPlan';
import { PlanError } from '../../domain/errors/PlanError';
import { SweepFees } from '../../domain/services/SweepFees';
import type { PlanRequest, PlanView, RunPlans, SweepView } from '../ports/in/RunPlans';
import type { Mandates } from '../ports/out/Mandates';
import type { Plans } from '../ports/out/Plans';

export class PlanService implements RunPlans {
  constructor(
    private readonly plans: Plans,
    private readonly mandates: Mandates,
    private readonly fees: SweepFees = new SweepFees(),
  ) {}

  async start(r: PlanRequest): Promise<PlanView> {
    if (r.address.trim() === '') throw new PlanError('a plan needs an address');
    const fee = this.fees.fee(r.flues);
    const sweepsPerYear = this.fees.sweepsPerYear(r.sweepsPerYear);
    const mandate = await this.mandates.find(r.mandateId);
    const plan: SweepPlan = { planId: r.planId, address: r.address, flues: r.flues, sweepsPerYear, fee, mandateId: r.mandateId, bankReference: mandate.reference, state: 'running', sweeps: [] };
    await this.plans.save(plan);
    return this.view(plan);
  }

  async recordSweep(planId: string, date: string): Promise<SweepView> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new PlanError('a sweep day is written YYYY-MM-DD');
    const p = await this.get(planId);
    if (p.state !== 'running') throw new PlanError('the plan is not running');
    const next: SweepPlan = { ...p, sweeps: [...p.sweeps, date] };
    await this.plans.save(next);
    return { planId, status: 'swept', date };
  }

  async stop(planId: string): Promise<PlanView> {
    const p = await this.get(planId);
    const next: SweepPlan = { ...p, state: 'stopped' };
    await this.plans.save(next);
    return this.view(next);
  }

  private async get(planId: string): Promise<SweepPlan> {
    const p = await this.plans.get(planId);
    if (p === null) throw new PlanError('there is no plan ' + planId);
    return p;
  }

  private view(p: SweepPlan): PlanView {
    return { planId: p.planId, status: p.state, fee: p.fee, sweepsPerYear: p.sweepsPerYear };
  }
}
