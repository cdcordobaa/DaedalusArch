import { ClearwiseClient, ClearwiseError, EntryStatus } from 'clearwise-sdk';
import { CustomsFilingPort, EntryDeclaration } from '../../../application/ports/out/customs-filing.port';
import { FilingOutcome, FilingReceipt } from '../../../domain/clearance';
import { FilingUnavailableError } from '../../../domain/errors';

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
        outcome: this.toOutcome(res.entry_status),
        dutyCents: Math.round(res.duty_amount_usd * 100),
        statusCode: res.entry_status,
      };
    } catch (e) {
      if (e instanceof ClearwiseError) throw new FilingUnavailableError(`customs filing failed: ${e.message}`);
      throw e;
    }
  }

  private toOutcome(status: EntryStatus): FilingOutcome {
    switch (status) {
      case 'FILED':
      case 'RELEASED':
        return 'accepted';
      case 'EXAM_HOLD':
      case 'DOCS_REQUIRED':
        return 'needs-attention';
      case 'REJECTED':
        return 'refused';
    }
  }
}
