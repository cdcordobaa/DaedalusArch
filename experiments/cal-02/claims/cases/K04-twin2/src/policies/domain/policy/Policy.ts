import { DomainEvent } from "../../../shared-kernel/DomainEvent";
import { Money } from "../../../shared-kernel/Money";

export class PolicyCancelled implements DomainEvent {
  readonly name = "PolicyCancelled";
  readonly occurredAt = Date.now();
  constructor(readonly policyId: string) {}
}

export class Policy {
  private active = true;
  private reserved: Money;
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly holder: string,
    private limit: Money,
  ) {
    this.reserved = Money.zero(limit.currency);
  }

  static issue(id: string, holder: string, limit: Money): Policy {
    if (!id.trim() || !holder.trim()) {
      throw new Error("policy needs an id and a holder");
    }
    if (limit.cents <= 0) {
      throw new Error("coverage limit must be positive");
    }
    return new Policy(id, holder, limit);
  }

  raiseLimit(newLimit: Money): void {
    if (!this.active) {
      throw new Error("policy is not active");
    }
    if (!newLimit.isGreaterThan(this.limit)) {
      throw new Error("new limit must be higher");
    }
    this.limit = newLimit;
  }

  isActive(): boolean {
    return this.active;
  }

  remaining(): Money {
    return this.limit.minus(this.reserved);
  }

  cancel(): void {
    if (!this.active) {
      throw new Error("policy already cancelled");
    }
    this.active = false;
    this.events.push(new PolicyCancelled(this.id));
  }

  reserveCoverage(amount: Money): void {
    if (!this.active) {
      throw new Error("policy is not active");
    }
    if (amount.isGreaterThan(this.remaining())) {
      throw new Error("amount exceeds remaining coverage");
    }
    this.reserved = this.reserved.plus(amount);
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
