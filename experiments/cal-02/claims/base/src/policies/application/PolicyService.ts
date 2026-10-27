import { EventBus } from "../../shared-kernel/DomainEvent";
import { Money } from "../../shared-kernel/Money";
import { Policy } from "../domain/policy/Policy";
import { PolicyRepository } from "../domain/policy/PolicyRepository";

export interface PolicyView {
  readonly active: boolean;
  readonly remainingCents: number;
}

export class PolicyService {
  constructor(private readonly repo: PolicyRepository, private readonly bus: EventBus) {}

  issuePolicy(id: string, holder: string, limitCents: number): void {
    const policy = Policy.issue(id, holder, Money.of(limitCents));
    this.repo.save(policy);
  }

  cancelPolicy(id: string): void {
    const policy = this.require(id);
    policy.cancel();
    this.repo.save(policy);
    this.bus.publish(policy.pullEvents());
  }

  reserveCoverage(id: string, cents: number): void {
    const policy = this.require(id);
    policy.reserveCoverage(Money.of(cents));
    this.repo.save(policy);
  }

  coverageOf(id: string): PolicyView | undefined {
    const policy = this.repo.byId(id);
    if (!policy) {
      return undefined;
    }
    return { active: policy.isActive(), remainingCents: policy.remaining().cents };
  }

  private require(id: string): Policy {
    const policy = this.repo.byId(id);
    if (!policy) {
      throw new Error(`policy ${id} not found`);
    }
    return policy;
  }
}
