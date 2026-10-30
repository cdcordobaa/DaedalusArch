import { AdjudicationFault, RxClaimClient } from 'rxclaim-sdk';
import { CoverageCheckPort, CoverageQuery } from '../../../application/ports/out/coverage-check.port';
import { CoverageDecision } from '../../../domain/coverage';
import { CoverageUnavailableError } from '../../../domain/errors';
import { toVerdict } from './rxclaim-mapper';

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
        verdict: toVerdict(res),
        copayCents: Math.round(res.patient_pay_amount * 100),
      };
    } catch (e) {
      if (e instanceof AdjudicationFault) throw new CoverageUnavailableError(`claim switch unavailable: ${e.message}`);
      throw e;
    }
  }
}
