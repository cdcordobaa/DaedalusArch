import { DomainEvent } from "../../shared-kernel/DomainEvent";

export interface ClaimApprovedMessage extends DomainEvent {
  readonly claimId: string;
  readonly policyId: string;
  readonly amountCents: number;
  readonly currency: string;
}
