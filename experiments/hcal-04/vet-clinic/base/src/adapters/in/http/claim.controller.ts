import type { SubmitClaimPort } from '../../../application/ports/in/submit-claim.port';
import type { HttpResponse, SubmitClaimRequestDto } from './appointment.dto';

export class ClaimController {
  constructor(private readonly submitClaim: SubmitClaimPort) {}

  async submit(body: SubmitClaimRequestDto): Promise<HttpResponse> {
    if (!body.invoiceId || !body.policyNumber) {
      return { status: 400, body: { error: 'missing field' } };
    }
    try {
      const result = await this.submitClaim.execute({ invoiceId: body.invoiceId, policyNumber: body.policyNumber });
      return { status: 200, body: { reference: result.reference, outcome: result.outcome } };
    } catch (error) {
      return { status: 500, body: { error: 'internal error' } };
    }
  }
}
