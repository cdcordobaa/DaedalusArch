import { Policy } from "../domain/policy/Policy";
import { PolicyRepository } from "../domain/policy/PolicyRepository";

export class InMemoryPolicyRepository implements PolicyRepository {
  private readonly policies = new Map<string, Policy>();

  save(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  byId(id: string): Policy | undefined {
    return this.policies.get(id);
  }
}
