import { EventBus } from "../../shared-kernel/DomainEvent";
import { Money } from "../../shared-kernel/Money";
import { Claim } from "../domain/claim/Claim";
import { ClaimRepository } from "../domain/claim/ClaimRepository";
import { ClaimView } from "../contracts/ClaimView";

export interface ClaimLineInput {
  readonly description: string;
  readonly cents: number;
}

export class ClaimService {
  constructor(private readonly repo: ClaimRepository, private readonly bus: EventBus) {}

  fileClaim(id: string, policyId: string, lines: readonly ClaimLineInput[]): void {
    const items = lines.map((l) => ({ description: l.description, amount: Money.of(l.cents) }));
    const claim = Claim.file(id, policyId, items);
    this.repo.save(claim);
  }

  approveClaim(id: string): void {
    const claim = this.require(id);
    claim.approve();
    this.repo.save(claim);
    this.bus.publish(claim.pullEvents());
  }

  rejectClaim(id: string, reason: string): void {
    const claim = this.require(id);
    claim.reject(reason);
    this.repo.save(claim);
    this.bus.publish(claim.pullEvents());
  }

  markPaid(id: string): void {
    const claim = this.require(id);
    claim.markPaid();
    this.repo.save(claim);
  }

  viewOf(id: string): ClaimView | undefined {
    const claim = this.repo.byId(id);
    if (!claim) {
      return undefined;
    }
    return { policyId: claim.policyId, totalCents: claim.total().cents, status: claim.currentStatus() };
  }

  private require(id: string): Claim {
    const claim = this.repo.byId(id);
    if (!claim) {
      throw new Error(`claim ${id} not found`);
    }
    return claim;
  }
}
