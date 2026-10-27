import { DomainEvent, EventBus } from "../../shared-kernel/DomainEvent";
import { Money } from "../../shared-kernel/Money";
import { TransactionManager } from "../../shared-kernel/TransactionManager";
import { ClaimApprovedMessage } from "../../claims";
import { InMemoryPolicyRepository } from "../../policies/infrastructure/InMemoryPolicyRepository";
import { Payout } from "../domain/payout/Payout";
import { PayoutRepository } from "../domain/payout/PayoutRepository";
import { PaymentGateway } from "./PaymentGateway";

export interface PayoutView {
  readonly claimId: string;
  readonly state: string;
  readonly cents: number;
}

export class PayoutService {
  constructor(private readonly repo: PayoutRepository, private readonly gateway: PaymentGateway, private readonly tx: TransactionManager, private readonly bus: EventBus, private readonly policies: InMemoryPolicyRepository) {}

  onClaimApproved(event: DomainEvent): void {
    const message = event as ClaimApprovedMessage;
    const policy = this.policies.byId(message.policyId);
    if (!policy || !policy.isActive()) {
      return;
    }
    const payout = Payout.create(
      `PO-${message.claimId}`,
      message.claimId,
      message.policyId,
      `PAY-${message.claimId}`,
      Money.of(message.amountCents, message.currency),
    );
    this.repo.save(payout);
  }

  dispatchPayout(id: string): void {
    const payout = this.require(id);
    payout.markDispatched();
    this.tx.run(() => this.repo.save(payout));
    this.gateway.send(payout.id, payout.amount());
    this.bus.publish(payout.pullEvents());
  }

  payoutView(id: string): PayoutView | undefined {
    const payout = this.repo.byId(id);
    if (!payout) {
      return undefined;
    }
    return { claimId: payout.claimId, state: payout.currentState(), cents: payout.amount().cents };
  }

  private require(id: string): Payout {
    const payout = this.repo.byId(id);
    if (!payout) {
      throw new Error(`payout ${id} not found`);
    }
    return payout;
  }
}
