import { AdjudicationFault as RxFault, ClaimResponse, RxClaimClient } from 'rxclaim-sdk';
import { CoverageCheckPort, CoverageQuery } from '../../../application/ports/out/coverage-check.port';
import { CoverageDecision, CoverageVerdict } from '../../../domain/coverage';
import { AdjudicationFault } from '../../../domain/errors';

export class RxClaimCoverageGateway implements CoverageCheckPort {
  private readonly client: RxClaimClient;

  constructor(apiKey: string, private readonly binNumber: string) {
    this.client = new RxClaimClient({ api_key: apiKey });
  }

  async check(query: CoverageQuery): Promise<CoverageDecision> {
    try {
      const res = await this.client.adjudicate({
        member_id: query.coverageId,
        bin_number: this.binNumber,
        ndc_code: query.productCode,
        quantity_dispensed: query.quantity,
      });
      return {
        claimRef: res.claim_ref,
        verdict: this.toVerdict(res),
        copayCents: Math.round(res.patient_pay_amount * 100),
      };
    } catch (e) {
      if (e instanceof RxFault) throw new AdjudicationFault(e.fault_code, `claim switch unavailable: ${e.message}`);
      throw e;
    }
  }

  private toVerdict(res: ClaimResponse): CoverageVerdict {
    switch (res.claim_status) {
      case 'PAID':
      case 'CAPTURED':
        return 'covered';
      case 'PENDING_PA':
        return 'prior-auth';
      case 'REJECTED':
        return res.reject_codes.includes('R75') ? 'prior-auth' : 'not-covered';
      case 'REVERSED':
        return 'not-covered';
    }
  }
}
