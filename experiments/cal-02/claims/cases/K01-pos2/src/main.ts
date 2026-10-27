import { InMemoryEventBus } from "./shared-kernel/DomainEvent";
import { InMemoryTransactionManager } from "./shared-kernel/TransactionManager";
import { InMemoryPolicyRepository, PolicyService } from "./policies";
import { ClaimService, InMemoryClaimRepository } from "./claims";
import { FakePaymentGateway, InMemoryPayoutRepository, PayoutService } from "./payouts";

export function createApp() {
  const bus = new InMemoryEventBus();
  const tx = new InMemoryTransactionManager();
  const policyRepo = new InMemoryPolicyRepository();
  const policies = new PolicyService(policyRepo, bus);
  const claims = new ClaimService(new InMemoryClaimRepository(), bus);
  const payouts = new PayoutService(new InMemoryPayoutRepository(), new FakePaymentGateway(), tx, bus, policyRepo);
  bus.subscribe("ClaimApproved", (event) => payouts.onClaimApproved(event));
  return { policies, claims, payouts, drain: () => bus.drain() };
}
