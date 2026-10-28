import type { ClaimOutcome, RejectionReason } from './claim-outcome';
import { Money } from './money';

export class Invoice {
  private claimOutcome: ClaimOutcome | undefined;
  private claimReason: RejectionReason | undefined;

  constructor(
    readonly id: string,
    readonly ownerId: string,
    readonly appointmentId: string,
    readonly treatmentCode: string,
    readonly total: Money,
  ) {}

  static issueCancellationFee(id: string, ownerId: string, appointmentId: string): Invoice {
    return new Invoice(id, ownerId, appointmentId, 'CANCELLATION', Money.of(2500));
  }

  recordClaim(outcome: ClaimOutcome, reason?: RejectionReason): void {
    this.claimOutcome = outcome;
    this.claimReason = reason;
  }

  getClaimOutcome(): ClaimOutcome | undefined {
    return this.claimOutcome;
  }

  getClaimReason(): RejectionReason | undefined {
    return this.claimReason;
  }
}
