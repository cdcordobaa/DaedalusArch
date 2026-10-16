import { Policy } from '../domain/policy/Policy';
import { PolicyRepository } from '../domain/policy/PolicyRepository';

export class InMemoryPolicyRepository implements PolicyRepository {
  private readonly policies = new Map<string, Policy>();

  async byNumber(number: string): Promise<Policy | undefined> {
    return this.policies.get(number);
  }

  async save(policy: Policy): Promise<void> {
    this.policies.set(policy.number, policy);
  }
}
