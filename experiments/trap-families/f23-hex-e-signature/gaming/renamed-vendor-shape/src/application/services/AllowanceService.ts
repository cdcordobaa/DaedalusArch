import type { AllowanceView, ShowAllowance } from '../ports/in/ShowAllowance';
import type { AllowanceSource } from '../ports/out/AllowanceSource';

export class AllowanceService implements ShowAllowance {
  constructor(private readonly source: AllowanceSource) {}

  async allowance(): Promise<AllowanceView> {
    const a = await this.source.current();
    return { remaining: a.remaining, renewsOn: a.renewsOn.toISOString().slice(0, 10) };
  }
}
