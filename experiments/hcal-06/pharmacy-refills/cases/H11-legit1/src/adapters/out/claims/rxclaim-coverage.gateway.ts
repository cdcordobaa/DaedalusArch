import { AdjudicationFault, ClaimResponse, FaultCode, RejectCode, RxClaimClient } from 'rxclaim-sdk';
import { CoverageCheckPort, CoverageQuery } from '../../../application/ports/out/coverage-check.port';
import { CoverageDecision, CoverageVerdict } from '../../../domain/coverage';
import { CoverageUnavailableError } from '../../../domain/errors';

const PRIOR_AUTH_REJECTS: ReadonlySet<RejectCode> = new Set<RejectCode>(['R75']);

const FAULT_TEXT: Readonly<Record<FaultCode, string>> = {
  PAYER_TIMEOUT: 'the patient plan did not answer in time',
  BIN_UNKNOWN: 'the plan identifier is not known to the claim switch',
  SWITCH_DOWN: 'the claim switch is down',
};

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
      if (e instanceof AdjudicationFault) throw new CoverageUnavailableError(FAULT_TEXT[e.fault_code]);
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
        return res.reject_codes.some((c) => PRIOR_AUTH_REJECTS.has(c)) ? 'prior-auth' : 'not-covered';
      case 'REVERSED':
        return 'not-covered';
    }
  }
}
