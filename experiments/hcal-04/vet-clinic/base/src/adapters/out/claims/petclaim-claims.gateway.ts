import { PetClaimClient, PetClaimError } from 'petclaim-sdk';
import type { ClaimResponse, DeclineCode } from 'petclaim-sdk';
import type { RejectionReason } from '../../../domain/claim-outcome';
import { ClaimsUnavailableError } from '../../../domain/errors';
import type {
  ClaimRequestData,
  ClaimResult,
  ClaimsGatewayPort,
} from '../../../application/ports/out/claims-gateway.port';

export class PetClaimsGateway implements ClaimsGatewayPort {
  private readonly client: PetClaimClient;

  constructor(apiKey: string) {
    this.client = new PetClaimClient({ apiKey });
  }

  async submit(request: ClaimRequestData): Promise<ClaimResult> {
    try {
      const response = await this.client.submitClaim({
        policy_no: request.policyNumber,
        claim_amount_cents: request.amountCents,
        treatment_code: request.treatmentCode,
      });
      return this.translate(response);
    } catch (error) {
      if (error instanceof PetClaimError) throw new ClaimsUnavailableError(error.message);
      throw error;
    }
  }

  private translate(response: ClaimResponse): ClaimResult {
    switch (response.claim_status) {
      case 'APPROVED':
        return { reference: response.claim_ref, outcome: 'accepted' };
      case 'PENDING_REVIEW':
        return { reference: response.claim_ref, outcome: 'under-review' };
      case 'DENIED':
        return { reference: response.claim_ref, outcome: 'rejected', reason: this.reasonFor(response.decline_code) };
    }
  }

  private reasonFor(code: DeclineCode | undefined): RejectionReason {
    switch (code) {
      case 'POLICY_LAPSED':
        return 'coverage-ended';
      case 'LIMIT_EXCEEDED':
        return 'limit-reached';
      default:
        return 'existing-condition';
    }
  }
}
