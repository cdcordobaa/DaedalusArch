import { DomainEvent } from "../../../shared-kernel/DomainEvent";
import { Money } from "../../../shared-kernel/Money";

export type PayoutState = "pending" | "dispatched" | "cancelled";

export const MAX_DISPATCH_CENTS = 1_000_000;

export class PayoutDispatched implements DomainEvent {
  readonly name = "PayoutDispatched";
  readonly occurredAt = Date.now();
  constructor(readonly payoutId: string, readonly claimId: string) {}
}

export class Payout {
  private state: PayoutState = "pending";
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly claimId: string,
    readonly policyId: string,
    readonly reference: string,
    private value: Money,
  ) {}

  static create(id: string, claimId: string, policyId: string, reference: string, amount: Money): Payout {
    if (!id.trim() || !claimId.trim()) {
      throw new Error("payout needs ids");
    }
    if (amount.cents <= 0) {
      throw new Error("payout amount must be positive");
    }
    return new Payout(id, claimId, policyId, reference, amount);
  }

  amount(): Money {
    return this.value;
  }

  currentState(): PayoutState {
    return this.state;
  }

  markDispatched(): void {
    if (this.state !== "pending") {
      throw new Error("only pending payouts can be dispatched");
    }
    if (this.value.cents > MAX_DISPATCH_CENTS) {
      throw new Error("payout above the dispatch cap");
    }
    this.state = "dispatched";
    this.events.push(new PayoutDispatched(this.id, this.claimId));
  }

  cancel(): void {
    if (this.state !== "pending") {
      throw new Error("only pending payouts can be cancelled");
    }
    this.state = "cancelled";
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
