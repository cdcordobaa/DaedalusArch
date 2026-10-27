import { Policy } from "../domain/policy/Policy";
import { PolicyRepository } from "../domain/policy/PolicyRepository";
import { Mutex } from "./Mutex";

export class InMemoryPolicyRepository implements PolicyRepository {
  private readonly policies = new Map<string, Policy>();
  private readonly writeLock = new Mutex();

  save(policy: Policy): void {
    this.writeLock.runExclusive(() => this.policies.set(policy.id, policy));
  }

  byId(id: string): Policy | undefined {
    return this.policies.get(id);
  }
}
