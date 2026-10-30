import { ClearwiseClient, ClearwiseError, ClearwiseErrorCode, EntryStatus } from 'clearwise-sdk';
import { CustomsFilingPort, EntryDeclaration } from '../../../application/ports/out/customs-filing.port';
import { FilingOutcome, FilingReceipt } from '../../../domain/clearance';
import { FilingUnavailableError } from '../../../domain/errors';

const OUTCOME_BY_STATUS: Readonly<Record<EntryStatus, FilingOutcome>> = {
  FILED: 'accepted',
  RELEASED: 'accepted',
  EXAM_HOLD: 'needs-attention',
  DOCS_REQUIRED: 'needs-attention',
  REJECTED: 'refused',
};

const REASON_BY_ERROR: Readonly<Record<ClearwiseErrorCode, string>> = {
  HTS_INVALID: 'the tariff code was not accepted',
  BOND_INSUFFICIENT: 'the customs bond does not cover this entry',
  RATE_LIMITED: 'the filing service is busy',
  PORT_CLOSED: 'the port of entry is not accepting filings',
};

export class ClearwiseFilingGateway implements CustomsFilingPort {
  private readonly client: ClearwiseClient;

  constructor(apiKey: string) {
    this.client = new ClearwiseClient({ api_key: apiKey });
  }

  async file(declaration: EntryDeclaration): Promise<FilingReceipt> {
    try {
      const res = await this.client.fileEntry({
        importer_of_record: declaration.importerId,
        hts_code: declaration.tariffCode,
        declared_value_usd: declaration.declaredValueCents / 100,
        country_of_origin: declaration.originCountry,
        port_of_entry: declaration.portCode,
      });
      return {
        entryRef: res.entry_number,
        outcome: OUTCOME_BY_STATUS[res.entry_status],
        dutyCents: Math.round(res.duty_amount_usd * 100),
      };
    } catch (e) {
      if (e instanceof ClearwiseError) throw new FilingUnavailableError(`customs filing failed: ${REASON_BY_ERROR[e.code]}`);
      throw e;
    }
  }
}
