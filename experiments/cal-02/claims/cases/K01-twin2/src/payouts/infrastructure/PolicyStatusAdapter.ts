import { PolicyService } from "../../policies";
import { PolicyStatus } from "../application/PolicyStatus";

export class PolicyStatusAdapter implements PolicyStatus {
  constructor(private readonly policies: PolicyService) {}

  isActive(policyId: string): boolean {
    return this.policies.coverageOf(policyId)?.active ?? false;
  }
}
