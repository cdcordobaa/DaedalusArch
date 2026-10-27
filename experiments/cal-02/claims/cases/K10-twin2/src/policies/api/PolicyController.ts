import { PolicyService } from "../application/PolicyService";

export interface ReserveResult {
  readonly ok: boolean;
  readonly error?: string;
}

export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  reserve(policyId: string, cents: number): ReserveResult {
    try {
      this.policies.reserveCoverage(policyId, cents);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
