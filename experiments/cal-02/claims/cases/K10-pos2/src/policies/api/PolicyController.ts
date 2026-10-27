import { PolicyService } from "../application/PolicyService";

export interface ReserveResult {
  readonly ok: boolean;
  readonly error?: string;
}

export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  reserve(policyId: string, cents: number): ReserveResult {
    const view = this.policies.coverageOf(policyId);
    if (!view || cents > view.remainingCents) {
      return { ok: false, error: "coverage limit exceeded" };
    }
    this.policies.reserveCoverage(policyId, cents);
    return { ok: true };
  }
}
