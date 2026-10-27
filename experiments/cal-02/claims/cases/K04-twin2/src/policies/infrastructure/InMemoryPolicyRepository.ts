import { Policy } from "../domain/policy/Policy";
import { PolicyRepository } from "../domain/policy/PolicyRepository";

export class InMemoryPolicyRepository implements PolicyRepository {
  private readonly policies = new Map<string, Policy>();

  save(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  byHolder(holder: string): Policy[] {
    return [...this.policies.values()].filter((policy) => policy.holder === holder);
  }

  byId(id: string): Policy | undefined {
    return this.policies.get(id);
  }
}
