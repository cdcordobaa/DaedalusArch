import { PolicyService } from "../../policies";
import { PolicyLookup } from "../application/PolicyLookup";

export class PolicyLookupAdapter implements PolicyLookup {
  constructor(private readonly policies: PolicyService) {}

  isActive(policyId: string): boolean {
    return this.policies.coverageOf(policyId)?.active ?? false;
  }
}
